import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SplitMoneyService } from '../services/split-money.service';
import { PeopleService } from '../services/people.service';
import { SplitGroup } from '../models/split.model';
import { Person } from '../models/person.model';
import { PayerAmount } from '../models/payeramount.model';
import { PersonTotal } from '../models/persontotal.model';

interface PersonSelection extends Person {
  selected: boolean;
}



type ActiveView = 'people' | 'newSplit' | null;
type PayMode = 'single' | 'multiple';

@Component({
  selector: 'app-split-money',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './split-money.component.html',
  styleUrl: './split-money.component.css'
})
export class SplitMoneyComponent implements OnInit {
  // --- view / navigation state ---
  activeView: ActiveView = null;

  // --- new split form ---
  title = '';
  totalAmount: number | null = null;

  // --- who paid ---
  payMode: PayMode = 'single';
  payerId: number | null = null;
  payerAmounts: PayerAmount[] = [];

  // --- people management ---
  people: Person[] = [];
  newPersonName = '';
  peopleLoading = false;

  // --- split selection (who owes a share) ---
  personSelections: PersonSelection[] = [];

  splits: SplitGroup[] = [];
  selectedSplit: SplitGroup | null = null;
  loading = false;
  errorMessage = '';

  constructor(
    private splitMoneyService: SplitMoneyService,
    private peopleService: PeopleService
  ) {}

  ngOnInit(): void {
    this.loadPeople();
    this.loadSplits();
  }

  // ---------- view navigation ----------

  openView(view: 'people' | 'newSplit'): void {
    this.errorMessage = '';
    this.activeView = view;
  }

  closeView(): void {
    this.activeView = null;
  }

  // ---------- people list ----------

  loadPeople(): void {
    this.peopleService.getAllPeople().subscribe({
      next: (data) => {
        this.people = data;

        this.personSelections = data.map((p) => {
          const existing = this.personSelections.find((s) => s.id === p.id);
          return { ...p, selected: existing ? existing.selected : true };
        });

        this.syncPayerAmounts();
      },
      error: (err) => (this.errorMessage = 'Could not load people: ' + err.message)
    });
  }

  addPerson(): void {
    const name = this.newPersonName.trim();
    if (!name) return;

    this.peopleLoading = true;
    this.peopleService.addPerson(name).subscribe({
      next: () => {
        this.peopleLoading = false;
        this.newPersonName = '';
        this.loadPeople();
      },
      error: (err) => {
        this.peopleLoading = false;
        this.errorMessage = 'Could not add person: ' + err.message;
      }
    });
  }

  removePerson(id: number): void {
    this.peopleService.deletePerson(id).subscribe({
      next: () => this.loadPeople(),
      error: (err) => (this.errorMessage = 'Could not remove person: ' + err.message)
    });
  }

  // ---------- who owes a share ----------

  togglePerson(index: number): void {
    this.personSelections[index].selected = !this.personSelections[index].selected;
  }

  get selectedCount(): number {
    return this.personSelections.filter((p) => p.selected).length;
  }

  get amountPerPerson(): number {
    return this.selectedCount && this.totalAmount ? this.totalAmount / this.selectedCount : 0;
  }

  // ---------- who paid ----------

  setPayMode(mode: PayMode): void {
    this.payMode = mode;
    if (mode === 'multiple') this.syncPayerAmounts();
  }

  private syncPayerAmounts(): void {
    this.payerAmounts = this.personSelections.map((p) => {
      const existing = this.payerAmounts.find((pa) => pa.id === p.id);
      return { id: p.id, name: p.name, amount: existing ? existing.amount : null };
    });

    if (this.payerId && !this.personSelections.find((p) => p.id === this.payerId)) {
      this.payerId = null;
    }
  }

  get totalPaidInForm(): number {
    return this.payerAmounts.reduce((sum, pa) => sum + (pa.amount || 0), 0);
  }

  get paymentRemaining(): number {
    return this.totalAmount ? Math.round((this.totalAmount - this.totalPaidInForm) * 100) / 100 : 0;
  }

  // ---------- totals across all splits ----------

  get personTotals(): PersonTotal[] {
    const map = new Map<number, PersonTotal>();

    const ensure = (personId: number, name: string): PersonTotal => {
      let entry = map.get(personId);
      if (!entry) {
        entry = { personId, name, totalPaid: 0, totalToReceive: 0, totalToPay: 0 };
        map.set(personId, entry);
      }
      return entry;
    };

    // seed every known person so they show up even with all zeros
    for (const p of this.people) {
      ensure(p.id, p.name);
    }

    for (const split of this.splits) {
      const participants = (split as any).participants as
        | { PersonId: number; Name: string; AmountOwed: number; Paid: boolean }[]
        | undefined;
      const payers = (split as any).payers as { personId: number; amount: number }[] | undefined;

      if (!participants?.length || !payers?.length) continue;

      // Net balance per person for THIS split = amountPaid - amountOwed (unpaid only).
      // Positive net => they're owed money back; negative net => they still owe.
      // This correctly handles people who both paid AND owe a share, and works
      // for any number of payers (unlike proportional distribution by payment size).
      const netBalances = new Map<number, number>();
      const nameById = new Map<number, string>();

      for (const payer of payers) {
        const payerName = this.people.find((p) => p.id === payer.personId)?.name || 'Unknown';
        nameById.set(payer.personId, payerName);

        // credit each payer with what they actually paid (running total across all splits)
        const entry = ensure(payer.personId, payerName);
        entry.totalPaid += payer.amount;

        netBalances.set(payer.personId, (netBalances.get(payer.personId) || 0) + payer.amount);
      }

      for (const participant of participants) {
        if (participant.Paid) continue; // already settled, doesn't affect balances

        nameById.set(participant.PersonId, participant.Name);
        netBalances.set(
          participant.PersonId,
          (netBalances.get(participant.PersonId) || 0) - participant.AmountOwed
        );
      }

      // roll each person's net balance for this split into their running totals
      for (const [personId, net] of netBalances.entries()) {
        const rounded = Math.round(net * 100) / 100;
        if (rounded === 0) continue;

        const entry = ensure(personId, nameById.get(personId) || 'Unknown');
        if (rounded > 0) {
          entry.totalToReceive += rounded;
        } else {
          entry.totalToPay += -rounded;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid);
  }

  // ---------- create split ----------

  createSplit(): void {
    this.errorMessage = '';

    if (!this.totalAmount || this.totalAmount <= 0) {
      this.errorMessage = 'Please enter a valid total amount';
      return;
    }

    const personIds = this.personSelections.filter((p) => p.selected).map((p) => p.id);

    if (personIds.length === 0) {
      this.errorMessage = 'Select at least one person to split with';
      return;
    }

    let payers: { personId: number; amount: number }[];

    if (this.payMode === 'single') {
      if (!this.payerId) {
        this.errorMessage = 'Select who paid';
        return;
      }
      payers = [{ personId: this.payerId, amount: this.totalAmount }];
    } else {
      if (this.paymentRemaining !== 0) {
        this.errorMessage =
          this.paymentRemaining > 0
            ? `Payments don't add up yet — ${this.paymentRemaining.toFixed(2)} left to assign`
            : `Payments exceed the total by ${Math.abs(this.paymentRemaining).toFixed(2)}`;
        return;
      }
      payers = this.payerAmounts
        .filter((pa) => (pa.amount || 0) > 0)
        .map((pa) => ({ personId: pa.id, amount: pa.amount as number }));

      if (payers.length === 0) {
        this.errorMessage = 'Assign at least one payment amount';
        return;
      }
    }

    this.loading = true;

    this.splitMoneyService
      .createSplit({
        title: this.title || 'Untitled Split',
        totalAmount: this.totalAmount,
        personIds,
        payers
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.resetForm();
          this.loadSplits();
          this.activeView = null;
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = 'Could not create split: ' + err.message;
        }
      });
  }

  createSplitAndReturn(): void {
    this.createSplit();
  }

  loadSplits(): void {
    this.splitMoneyService.getAllSplits().subscribe({
      next: (data) => (this.splits = data),
      error: (err) => (this.errorMessage = 'Could not load splits: ' + err.message)
    });
  }

  viewSplit(split: SplitGroup): void {
    if (!split.Id) return;
    this.splitMoneyService.getSplitById(split.Id).subscribe({
      next: (data) => (this.selectedSplit = data),
      error: (err) => (this.errorMessage = 'Could not load split details: ' + err.message)
    });
  }

  closeDetails(): void {
    this.selectedSplit = null;
  }

  togglePaid(participantId: number | undefined, currentStatus: boolean): void {
    if (!this.selectedSplit?.Id || !participantId) return;
    this.splitMoneyService
      .updateParticipantPaid(this.selectedSplit.Id, participantId, !currentStatus)
      .subscribe({
        next: () => this.viewSplit(this.selectedSplit as SplitGroup),
        error: (err) => (this.errorMessage = 'Could not update status: ' + err.message)
      });
  }

  deleteSplit(id: number | undefined, event: Event): void {
    event.stopPropagation();
    if (!id) return;
    this.splitMoneyService.deleteSplit(id).subscribe({
      next: () => {
        this.loadSplits();
        if (this.selectedSplit?.Id === id) this.selectedSplit = null;
      },
      error: (err) => (this.errorMessage = 'Could not delete split: ' + err.message)
    });
  }

  private resetForm(): void {
    this.title = '';
    this.totalAmount = null;
    this.payerId = null;
    this.payerAmounts = this.payerAmounts.map((pa) => ({ ...pa, amount: null }));
  }
}