import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SplitMoneyComponent } from '../split-money/split-money.component';
import { WorkScheduleComponent } from '../work-schedule/work-schedule.component';

type TabId = 'split-money' | 'work-schedule';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SplitMoneyComponent, WorkScheduleComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  activeTab: TabId = 'split-money';

  setTab(tab: TabId): void {
    this.activeTab = tab;
  }
}
