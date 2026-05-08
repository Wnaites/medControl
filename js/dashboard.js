// Dashboard module for comprehensive treatment tracking

class TreatmentDashboard {
  constructor(options = {}) {
    this.storage = options.storage || (typeof storage !== 'undefined' ? storage : null);
    this.notifications = options.notifications || (typeof notificationManager !== 'undefined' ? notificationManager : null);
    this.app = options.app || (typeof window !== 'undefined' && window.app ? window.app : null);
  }

  // Initialize dashboard
  init() {
    this.renderTreatmentTimeline();
    this.setupEventListeners();
  }

  // Setup event listeners
  setupEventListeners() {
    const viewAllDosesBtn = document.getElementById('view-all-doses-btn');
    if (viewAllDosesBtn) {
      viewAllDosesBtn.addEventListener('click', () => this.openAllDosesModal());
    }

    const filterMedicine = document.getElementById('filter-medicine');
    if (filterMedicine) {
      filterMedicine.addEventListener('change', () => this.filterAllDoses());
    }

    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', () => this.filterAllDoses());
    }
  }

  // Render treatment timeline for all medicines
  renderTreatmentTimeline() {
    if (!this.storage) return;

    const container = document.getElementById('treatment-timeline');
    if (!container) return;

    const medicines = this.storage.getMedicines();

    if (medicines.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-check fa-3x"></i><h3>Nenhum tratamento em andamento</h3><p>Cadastre medicamentos para acompanhar seu tratamento</p></div>';
      return;
    }

    container.innerHTML = medicines.map(medicine => this.createMedicineTimeline(medicine)).join('');
  }

  // Create medicine timeline card
  createMedicineTimeline(medicine) {
    const now = new Date();
    const startDate = new Date(medicine.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + parseInt(medicine.durationDays));

    const totalDays = parseInt(medicine.durationDays);
    const daysElapsed = Math.max(0, Math.min(totalDays, Math.floor((now - startDate) / (1000 * 60 * 60 * 24))));
    const progressPercent = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

    const totalDoses = this.calculateTotalDoses(medicine);
    const takenDoses = this.calculateTakenDoses(medicine);
    const adherencePercent = totalDoses > 0 ? (takenDoses / totalDoses) * 100 : 0;

    let timelineHTML = '<div class="medicine-timeline" data-medicine-id="' + medicine.id + '">';
    timelineHTML += '<div class="medicine-timeline-header">';
    timelineHTML += '<div class="medicine-timeline-title"><i class="fas fa-pills"></i> ' + medicine.name + ' <span style="font-size: 0.875rem; color: var(--text-secondary); font-weight: normal;">(' + medicine.dosage + ')</span></div>';
    timelineHTML += '<div class="medicine-timeline-progress">';
    timelineHTML += '<div class="progress-bar-container"><div class="progress-bar" style="width: ' + progressPercent + '%"></div></div>';
    timelineHTML += '<span class="progress-text">' + Math.round(progressPercent) + '% concluído</span>';
    timelineHTML += '</div>';
    timelineHTML += '</div>';

    // Adherence info
    timelineHTML += '<div style="display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.875rem;">';
    timelineHTML += '<span><i class="fas fa-check-circle" style="color: var(--success-color);"></i> Adesão: ' + Math.round(adherencePercent) + '% (' + takenDoses + '/' + totalDoses + ' doses)</span>';
    timelineHTML += '<span><i class="fas fa-calendar"></i> Dia ' + (daysElapsed + 1) + ' de ' + totalDays + '</span>';
    timelineHTML += '</div>';

    // Timeline days grid
    timelineHTML += '<div class="timeline-days">';
    
    const maxDisplayDays = Math.min(totalDays, 30); // Show max 30 days for readability
    
    for (let day = 0; day < maxDisplayDays; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);
      
      const isToday = currentDate.toDateString() === now.toDateString();
      const isPast = currentDate < now.setHours(0, 0, 0, 0);
      const dayStatus = this.getDayStatus(medicine, currentDate, isPast);
      
      const dayNumber = day + 1;
      const dayDate = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const dosesCount = this.getDosesCountForDay(medicine, currentDate);
      
      let tooltipContent = 'Dia ' + dayNumber + ' - ' + dayDate + '<br>';
      tooltipContent += dosesCount + ' dose(s)<br>';
      if (dayStatus === 'completed') {
        tooltipContent += '<i class="fas fa-check"></i> Todas tomadas';
      } else if (dayStatus === 'overdue') {
        tooltipContent += '<i class="fas fa-exclamation-triangle"></i> Doses atrasadas';
      } else if (dayStatus === 'pending') {
        tooltipContent += '<i class="fas fa-clock"></i> Aguardando';
      }

      timelineHTML += '<div class="timeline-day ' + dayStatus + (isToday ? ' today' : '') + '" data-day="' + day + '" title="' + dayDate + '">';
      timelineHTML += '<span class="day-number">' + dayNumber + '</span>';
      timelineHTML += '<span class="day-doses">' + dosesCount + '</span>';
      timelineHTML += '<div class="timeline-day-tooltip">' + tooltipContent + '</div>';
      timelineHTML += '</div>';
    }

    if (totalDays > maxDisplayDays) {
      timelineHTML += '<div class="timeline-day" style="border-style: dashed;" title="Ver todas as doses no modal">';
      timelineHTML += '<span class="day-number">+' + (totalDays - maxDisplayDays) + '</span>';
      timelineHTML += '<span class="day-doses">dias</span>';
      timelineHTML += '</div>';
    }

    timelineHTML += '</div>'; // End timeline-days
    timelineHTML += '</div>'; // End medicine-timeline

    return timelineHTML;
  }

  // Get status for a specific day
  getDayStatus(medicine, date, isPast) {
    const dosesOnDay = this.getDosesForDay(medicine, date);
    if (dosesOnDay.length === 0) return '';

    const takenCount = dosesOnDay.filter(dose => this.isDoseTaken(medicine, dose)).length;

    if (takenCount === dosesOnDay.length) {
      return 'completed';
    } else if (isPast && takenCount < dosesOnDay.length) {
      return 'overdue';
    } else {
      return 'pending';
    }
  }

  // Get doses count for a specific day
  getDosesCountForDay(medicine, date) {
    return this.getDosesForDay(medicine, date).length;
  }

  // Get doses for a specific day (similar to notifications.js)
  getDosesForDay(medicine, targetDate) {
    const doses = [];
    const start = new Date(medicine.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + parseInt(medicine.durationDays));

    const targetStart = new Date(targetDate);
    targetStart.setHours(0, 0, 0, 0);
    const targetEnd = new Date(targetDate);
    targetEnd.setHours(23, 59, 59, 999);

    if (targetStart < start || targetStart > end) {
      return doses;
    }

    const dayOfWeek = targetDate.getDay();

    // Check frequency-specific rules
    switch (medicine.frequencyType) {
      case 'daily':
        break;
      case 'specific-days':
        const specificDays = medicine.specificDays || [];
        if (!specificDays.includes(dayOfWeek)) {
          return doses;
        }
        break;
      case 'weekly':
        const startDay = new Date(medicine.startDate).getDay();
        if (dayOfWeek !== startDay) {
          return doses;
        }
        break;
      case 'custom':
        break;
      default:
        return doses;
    }

    // Generate doses based on frequency type
    if (medicine.frequencyType === 'custom') {
      const interval = parseInt(medicine.customInterval) || 8;
      const dosesPerDay = Math.floor(24 / interval);

      for (let i = 0; i < dosesPerDay; i++) {
        const doseTime = new Date(targetStart);
        doseTime.setHours(i * interval, 0, 0, 0);
        doses.push(doseTime);
      }
    } else {
      const hours = medicine.time.split(':')[0];
      const minutes = medicine.time.split(':')[1];
      const doseTime = new Date(targetStart);
      doseTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      doses.push(doseTime);
    }

    return doses;
  }

  // Check if dose was taken
  isDoseTaken(medicine, doseTime) {
    if (!medicine.dosesTaken || !Array.isArray(medicine.dosesTaken)) {
      return false;
    }

    const doseHour = doseTime.getHours();
    const doseDate = doseTime.toDateString();

    return medicine.dosesTaken.some(dose => {
      const takenDate = new Date(dose.takenAt);
      const takenHour = takenDate.getHours();
      const timeDiff = Math.abs(takenHour - doseHour);

      return takenDate.toDateString() === doseDate && timeDiff <= 1;
    });
  }

  // Calculate total doses for treatment
  calculateTotalDoses(medicine) {
    const totalDays = parseInt(medicine.durationDays);
    let dosesPerDay = 1;

    if (medicine.frequencyType === 'custom') {
      const interval = parseInt(medicine.customInterval) || 8;
      dosesPerDay = Math.floor(24 / interval);
    }

    // Adjust for frequency type
    if (medicine.frequencyType === 'specific-days') {
      const specificDays = medicine.specificDays || [];
      const weeksInTreatment = Math.ceil(totalDays / 7);
      return specificDays.length * weeksInTreatment * dosesPerDay;
    }

    if (medicine.frequencyType === 'weekly') {
      const weeksInTreatment = Math.ceil(totalDays / 7);
      return weeksInTreatment * dosesPerDay;
    }

    return totalDays * dosesPerDay;
  }

  // Calculate taken doses
  calculateTakenDoses(medicine) {
    if (!medicine.dosesTaken || !Array.isArray(medicine.dosesTaken)) {
      return 0;
    }
    return medicine.dosesTaken.length;
  }

  // Open all doses modal
  openAllDosesModal() {
    if (!this.storage) return;

    const modal = document.getElementById('all-doses-modal');
    if (!modal) return;

    // Populate medicine filter
    const filterMedicine = document.getElementById('filter-medicine');
    if (filterMedicine) {
      const medicines = this.storage.getMedicines();
      filterMedicine.innerHTML = '<option value="">Todos os medicamentos</option>' +
        medicines.map(m => '<option value="' + m.id + '">' + m.name + '</option>').join('');
    }

    // Render all doses
    this.renderAllDoses();

    // Show modal
    modal.style.display = 'block';
  }

  // Render all doses list
  renderAllDoses(filteredMedicineId = '', filteredStatus = '') {
    if (!this.storage) return;

    const container = document.getElementById('all-doses-list');
    if (!container) return;

    const medicines = this.storage.getMedicines();
    const now = new Date();

    let allDoses = [];

    medicines.forEach(medicine => {
      if (filteredMedicineId && medicine.id !== filteredMedicineId) return;

      const allScheduledDoses = this.getAllScheduledDoses(medicine);

      allScheduledDoses.forEach(doseTime => {
        const isTaken = this.isDoseTaken(medicine, doseTime);
        const isPast = doseTime < now;
        const isOverdue = isPast && !isTaken;

        let status = 'pending';
        if (isTaken) status = 'taken';
        else if (isOverdue) status = 'overdue';

        if (filteredStatus && status !== filteredStatus) return;

        allDoses.push({
          medicine,
          time: doseTime,
          status,
          isTaken,
          isOverdue
        });
      });
    });

    // Sort by date/time
    allDoses.sort((a, b) => a.time - b.time);

    if (allDoses.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times fa-3x"></i><h3>Nenhuma dose encontrada</h3><p>Ajuste os filtros para ver mais resultados</p></div>';
      return;
    }

    container.innerHTML = allDoses.map(dose => {
      let statusIcon = 'clock';
      let statusText = 'Pendente';
      if (dose.status === 'taken') {
        statusIcon = 'check-circle';
        statusText = 'Tomada';
      } else if (dose.status === 'overdue') {
        statusIcon = 'exclamation-triangle';
        statusText = 'Atrasada';
      }

      return '<div class="dose-item ' + dose.status + '">' +
        '<span class="dose-time">' + dose.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</span>' +
        '<div class="dose-info">' +
        '<div class="dose-medicine">' + dose.medicine.name + '</div>' +
        '<div class="dose-dosage">' + dose.medicine.dosage + '</div>' +
        '</div>' +
        '<span class="dose-status ' + dose.status + '"><i class="fas fa-' + statusIcon + '"></i> ' + statusText + '</span>' +
        (!dose.isTaken ? '<div class="dose-actions"><button class="btn-primary btn-small take-dose-btn-dashboard" data-medicine-id="' + dose.medicine.id + '" data-dose-time="' + dose.time.toISOString() + '"><i class="fas fa-check"></i> Tomar</button></div>' : '') +
        '</div>';
    }).join('');

    // Add event listeners for take dose buttons
    container.querySelectorAll('.take-dose-btn-dashboard').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const medicineId = e.currentTarget.dataset.medicineId;
        this.takeDoseFromDashboard(medicineId);
      });
    });
  }

  // Get all scheduled doses for a medicine
  getAllScheduledDoses(medicine) {
    const doses = [];
    const start = new Date(medicine.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + parseInt(medicine.durationDays));
    const now = new Date();

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      if (!this.shouldDoseOnDay(medicine, date)) {
        continue;
      }

      const dayDoses = this.getDosesForDay(medicine, date);
      dayDoses.forEach(dose => {
        doses.push(dose);
      });
    }

    return doses;
  }

  // Check if should dose on a specific day
  shouldDoseOnDay(medicine, date) {
    const dayOfWeek = date.getDay();
    const start = new Date(medicine.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + parseInt(medicine.durationDays));

    if (date < start || date > end) {
      return false;
    }

    switch (medicine.frequencyType) {
      case 'daily':
        return true;
      case 'specific-days':
        const specificDays = medicine.specificDays || [];
        return specificDays.includes(dayOfWeek);
      case 'weekly':
        return dayOfWeek === start.getDay();
      case 'custom':
        return true;
      default:
        return false;
    }
  }

  // Filter all doses based on selected filters
  filterAllDoses() {
    const filterMedicine = document.getElementById('filter-medicine');
    const filterStatus = document.getElementById('filter-status');

    const medicineId = filterMedicine ? filterMedicine.value : '';
    const status = filterStatus ? filterStatus.value : '';

    this.renderAllDoses(medicineId, status);
  }

  // Take dose from dashboard
  takeDoseFromDashboard(medicineId) {
    if (!this.storage || !this.app) return;

    this.storage.markDoseTaken(medicineId, new Date());

    if (this.app) {
      this.app.refreshUI();
    }

    this.renderTreatmentTimeline();
    this.filterAllDoses();

    if (this.app) {
      this.app.showToast('Dose registrada com sucesso! ✓');
    }

    if (this.notifications) {
      const medicine = this.storage.getMedicine(medicineId);
      if (medicine) {
        this.notifications.cancelMedicineNotifications(medicineId);
        this.notifications.scheduleMedicineNotifications(medicine);
      }
    }
  }
}

// Export for testing and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TreatmentDashboard };
} else {
  window.TreatmentDashboard = TreatmentDashboard;
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (typeof MedControleApp !== 'undefined' && window.app) {
    window.treatmentDashboard = new TreatmentDashboard({
      storage: typeof storage !== 'undefined' ? storage : null,
      notifications: typeof notificationManager !== 'undefined' ? notificationManager : null,
      app: window.app
    });
    window.treatmentDashboard.init();
  }
});
