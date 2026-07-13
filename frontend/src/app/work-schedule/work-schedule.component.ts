import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkScheduleService } from '../services/work-schedule.service';
import { WorkSchedule } from '../models/schedule.model';

@Component({
  selector: 'app-work-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './work-schedule.component.html',
  styleUrl: './work-schedule.component.css'
})
export class WorkScheduleComponent implements OnInit {
  employeeName = '';
  notes = '';
  workDate: string = this.getToday();

  schedules: WorkSchedule[] = [];
  loading = false;
  errorMessage = '';

  constructor(private workScheduleService: WorkScheduleService) {}

  ngOnInit(): void {
    this.loadSchedules();
  }

  loadSchedules(): void {
    this.workScheduleService.getAllSchedules().subscribe({
      next: (data) => (this.schedules = data),
      error: (err) => (this.errorMessage = 'Could not load schedules: ' + err.message)
    });
  }

  clockIn(): void {
    if (!this.employeeName.trim()) {
      this.errorMessage = 'Please enter a name before clocking in';
      return;
    }

    if (!this.workDate) {
      this.errorMessage = 'Please select a date before clocking in';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.workScheduleService.clockIn(this.employeeName, this.notes, this.workDate).subscribe({
      next: () => {
        this.loading = false;
        this.notes = '';
        this.workDate = this.getToday();
        this.loadSchedules();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Could not clock in: ' + err.message;
      }
    });
  }

  clockOut(schedule: WorkSchedule): void {
    if (!schedule.Id) return;
    this.workScheduleService.clockOut(schedule.Id).subscribe({
      next: () => this.loadSchedules(),
      error: (err) => (this.errorMessage = 'Could not clock out: ' + err.message)
    });
  }

  deleteSchedule(id: number | undefined): void {
    if (!id) return;
    this.workScheduleService.deleteSchedule(id).subscribe({
      next: () => this.loadSchedules(),
      error: (err) => (this.errorMessage = 'Could not delete record: ' + err.message)
    });
  }

  formatTime(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  hoursWorked(schedule: WorkSchedule): string {
    if (!schedule.ClockIn || !schedule.ClockOut) return '—';
    const ms = new Date(schedule.ClockOut).getTime() - new Date(schedule.ClockIn).getTime();
    const hours = ms / (1000 * 60 * 60);
    return hours.toFixed(2) + ' hrs';
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }
}