// Main application controller - Refactored version with DI support

class MedControleApp {
  constructor(options = {}) {
    this.storage = options.storage || (typeof storage !== 'undefined' ? storage : null);
    this.notifications = options.notifications || (typeof notificationManager !== 'undefined' ? notificationManager : null);
    this.ui = options.ui || (typeof ui !== 'undefined' ? ui : null);
    
    this.refreshTimer = null;
    this.init();
  }
  
  init() {
    this.registerServiceWorker();
    this.setupPeriodicRefresh();
    this.checkNotificationPermission();
    this.refreshUI();
  }

  // Register service worker for PWA
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registrado com sucesso:', registration);
        
        registration.addEventListener('updatefound', () => {
          console.log('Nova versão disponível');
          if (window.app) {
            window.app.showToast('Nova versão disponível! Recarregue a página.', 'info');
          }
        });
      } catch (error) {
        console.log('Falha ao registrar Service Worker:', error);
      }
    }
  }

  // Check notification permission
  async checkNotificationPermission() {
    if (!this.notifications) return;
    
    const permission = await this.notifications.checkPermission();
    
    if (permission === 'default') {
      setTimeout(() => {
        const modal = document.getElementById('notification-modal');
        if (modal) {
          modal.style.display = 'block';
        }
      }, 3000);
    }
  }

  // Refresh all UI elements
  refreshUI() {
    this.refreshMedicinesList();
    this.updateDashboard();
    this.updateTodaySchedule();
  }

  // Refresh medicines list
  refreshMedicinesList() {
    if (!this.storage) return;
    
    const medicines = this.storage.getMedicines();
    const container = document.getElementById('medicines-list');
    
    if (!container) return;
    
    if (medicines.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-pills fa-3x"></i><h3>Nenhum remédio cadastrado</h3><p>Clique no botão "Novo Remédio" para começar</p></div>';
      return;
    }

    container.innerHTML = medicines.map(medicine => this.createMedicineCard(medicine)).join('');
    this.addMedicineCardListeners();
  }

  // Create medicine card HTML
  createMedicineCard(medicine) {
    const status = this.getMedicineStatus(medicine);
    const nextDose = this.getNextDose(medicine);
    const endDate = this.calculateEndDate(medicine);
    const frequency = this.formatFrequency(medicine);
    
    return '<div class="medicine-card ' + status.class + '" data-medicine-id="' + medicine.id + '"><div class="medicine-header"><div><h3 class="medicine-name">' + medicine.name + '</h3><p class="medicine-dosage">' + medicine.dosage + '</p></div><span class="medicine-status status-' + status.class + '">' + status.text + '</span></div><div class="medicine-info"><div class="info-item"><span class="info-label">Próxima dose:</span><span class="info-value">' + nextDose + '</span></div><div class="info-item"><span class="info-label">Frequência:</span><span class="info-value">' + frequency + '</span></div><div class="info-item"><span class="info-label">Término:</span><span class="info-value">' + endDate + '</span></div>' + (medicine.frequencyType === 'custom' ? '<div class="info-item"><span class="info-label">Doses/dia:</span><span class="info-value">' + Math.floor(24 / (parseInt(medicine.customInterval) || 8)) + '</span></div>' : '') + '</div><div class="medicine-actions"><button class="btn-primary btn-small take-dose-btn" data-medicine-id="' + medicine.id + '" aria-label="Registrar dose de ' + medicine.name + '"><i class="fas fa-check"></i> Tomei</button><button class="btn-secondary btn-small edit-medicine-btn" data-medicine-id="' + medicine.id + '" aria-label="Editar ' + medicine.name + '"><i class="fas fa-edit"></i> Editar</button><button class="btn-secondary btn-small delete-medicine-btn" data-medicine-id="' + medicine.id + '" aria-label="Excluir ' + medicine.name + '"><i class="fas fa-trash"></i> Excluir</button></div></div>';
  }

  // Get medicine status
  getMedicineStatus(medicine) {
    const now = new Date();
    const hasTakenToday = this.isDoseTakenToday(medicine);
    const nextDoseTime = this.getNextDoseTimeObject(medicine);
    
    if (!nextDoseTime) {
      return { class: 'inactive', text: 'Inativo' };
    }
    
    if (hasTakenToday && medicine.frequencyType !== 'custom') {
      return { class: 'completed', text: 'Tomado' };
    }
    
    if (nextDoseTime < now && !hasTakenToday) {
      return { class: 'overdue', text: 'Atrasado' };
    }
    
    return { class: 'active', text: 'Ativo' };
  }

  // Get next dose time formatted
  getNextDose(medicine) {
    const nextDoseTime = this.getNextDoseTimeObject(medicine);
    
    if (!nextDoseTime) {
      return 'N/A';
    }
    
    return nextDoseTime.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Get next dose time as Date object
  getNextDoseTimeObject(medicine) {
    const now = new Date();
    const hours = medicine.time.split(':')[0];
    const minutes = medicine.time.split(':')[1];
    
    const nextDose = new Date();
    nextDose.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    if (nextDose < now) {
      if (medicine.frequencyType === 'custom') {
        const interval = parseInt(medicine.customInterval) || 8;
        const currentHour = now.getHours();
        const nextDoseHour = Math.floor(currentHour / interval) * interval + interval;
        
        if (nextDoseHour < 24) {
          nextDose.setHours(nextDoseHour, 0, 0, 0);
          return nextDose;
        }
      }
      nextDose.setDate(nextDose.getDate() + 1);
    }
    
    return nextDose;
  }

  // Calculate end date
  calculateEndDate(medicine) {
    const startDate = new Date(medicine.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + parseInt(medicine.durationDays));
    
    return endDate.toLocaleDateString('pt-BR');
  }

  // Format frequency display
  formatFrequency(medicine) {
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    switch (medicine.frequencyType) {
      case 'daily':
        return 'Diariamente';
      case 'specific-days':
        const days = medicine.specificDays || [];
        return days.map(d => dayNames[d]).join(', ');
      case 'weekly':
        return 'Semanalmente';
      case 'custom':
        const interval = medicine.customInterval || 8;
        const dosesPerDay = Math.floor(24 / interval);
        return dosesPerDay + 'x ao dia (a cada ' + interval + 'h)';
      default:
        return medicine.frequencyType;
    }
  }

  // Check if dose was taken today
  isDoseTakenToday(medicine) {
    if (!medicine.dosesTaken || !Array.isArray(medicine.dosesTaken)) {
      return false;
    }
    
    const today = new Date().toDateString();
    return medicine.dosesTaken.some(dose => 
      new Date(dose.takenAt).toDateString() === today
    );
  }

  // Add event listeners to medicine cards
  addMedicineCardListeners() {
    document.querySelectorAll('.take-dose-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const button = e.currentTarget;
        const medicineId = button.dataset.medicineId;
        this.takeDose(medicineId);
      });
    });

    document.querySelectorAll('.edit-medicine-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const medicineId = e.currentTarget.dataset.medicineId;
        this.editMedicine(medicineId);
      });
    });

    document.querySelectorAll('.delete-medicine-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const medicineId = e.currentTarget.dataset.medicineId;
        this.deleteMedicine(medicineId);
      });
    });
  }

  // Take dose action
  takeDose(medicineId) {
    if (!this.storage) return;
    
    const medicine = this.storage.getMedicine(medicineId);
    if (medicine) {
      this.storage.markDoseTaken(medicineId, new Date());
      this.refreshUI();
      this.showToast('Dose registrada com sucesso! ✓');
      
      if (this.notifications) {
        this.notifications.cancelMedicineNotifications(medicineId);
        this.notifications.scheduleMedicineNotifications(medicine);
      }
    }
  }

  // Edit medicine
  editMedicine(medicineId) {
    if (!this.storage || !this.ui) return;
    
    const medicine = this.storage.getMedicine(medicineId);
    if (medicine) {
      this.ui.openAddMedicineModal(medicine);
    }
  }

  // Delete medicine
  deleteMedicine(medicineId) {
    if (!this.storage) return;
    
    if (confirm('Tem certeza que deseja excluir este remédio? Esta ação não pode ser desfeita.')) {
      this.storage.deleteMedicine(medicineId);
      
      if (this.notifications) {
        this.notifications.cancelMedicineNotifications(medicineId);
      }
      
      this.refreshUI();
      this.showToast('Remédio excluído com sucesso!', 'success');
    }
  }

  // Update dashboard
  updateDashboard() {
    if (!this.storage) return;
    
    const medicines = this.storage.getMedicines();
    const todayDoses = this.storage.getTodayDoses();
    const overdueMedicines = this.storage.getOverdueMedicines();
    const completedToday = medicines.filter(m => this.isDoseTakenToday(m)).length;
    
    const totalEl = document.getElementById('total-medicines');
    const todayEl = document.getElementById('today-doses');
    const pendingEl = document.getElementById('pending-doses');
    const completedEl = document.getElementById('completed-today');
    
    if (totalEl) totalEl.textContent = medicines.length;
    if (todayEl) todayEl.textContent = todayDoses.length;
    if (pendingEl) pendingEl.textContent = overdueMedicines.length;
    if (completedEl) completedEl.textContent = completedToday;
  }

  // Update today's schedule display
  updateTodaySchedule() {
    if (!this.storage) return;
    
    const medicines = this.storage.getMedicines();
    const now = new Date();
    
    const allDosesToday = [];
    
    medicines.forEach(medicine => {
      const dosesToday = this.getDosesForMedicineToday(medicine);
      dosesToday.forEach(doseTime => {
        const isTaken = this.isDoseTakenAtTime(medicine, doseTime);
        const isPast = doseTime < now;
        
        allDosesToday.push({
          medicine,
          time: doseTime,
          isTaken,
          isPast,
          isOverdue: isPast && !isTaken
        });
      });
    });
    
    allDosesToday.sort((a, b) => a.time - b.time);
    
    const container = document.getElementById('today-schedule');
    if (container) {
      if (allDosesToday.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-check fa-3x"></i><h3>Nenhuma dose hoje</h3><p>Aproveite o dia!</p></div>';
      } else {
        container.innerHTML = allDosesToday.map(item => {
          let statusHtml = '';
          if (item.isTaken) {
            statusHtml = '<span class="schedule-status completed"><i class="fas fa-check-circle"></i> Tomada</span>';
          } else if (item.isOverdue) {
            statusHtml = '<span class="schedule-status overdue"><i class="fas fa-exclamation-triangle"></i> Atrasada</span>';
          } else {
            statusHtml = '<span class="schedule-status pending"><i class="fas fa-clock"></i> Pendente</span>';
          }
          
          return '<div class="schedule-item ' + (item.isTaken ? 'completed' : '') + ' ' + (item.isOverdue ? 'overdue' : '') + '"><span class="schedule-time">' + item.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</span><div class="schedule-info"><div class="schedule-medicine">' + item.medicine.name + '</div><div class="schedule-dosage">' + item.medicine.dosage + '</div></div><div class="schedule-actions">' + statusHtml + '</div></div>';
        }).join('');
      }
    }
  }

  // Get all doses for a medicine today
  getDosesForMedicineToday(medicine) {
    const doses = [];
    const today = new Date();
    
    const start = new Date(medicine.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + parseInt(medicine.durationDays));
    
    if (today < start || today > end) {
      return doses;
    }
    
    const dayOfWeek = today.getDay();
    
    if (medicine.frequencyType === 'specific-days') {
      const specificDays = medicine.specificDays || [];
      if (!specificDays.includes(dayOfWeek)) {
        return doses;
      }
    }
    
    if (medicine.frequencyType === 'weekly') {
      const startDay = new Date(medicine.startDate).getDay();
      if (dayOfWeek !== startDay) {
        return doses;
      }
    }
    
    if (medicine.frequencyType === 'custom') {
      const interval = parseInt(medicine.customInterval) || 8;
      const dosesPerDay = Math.floor(24 / interval);
      
      for (let i = 0; i < dosesPerDay; i++) {
        const doseTime = new Date(today);
        doseTime.setHours(i * interval, 0, 0, 0);
        doses.push(doseTime);
      }
    } else {
      const hours = medicine.time.split(':')[0];
      const minutes = medicine.time.split(':')[1];
      const doseTime = new Date(today);
      doseTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      doses.push(doseTime);
    }
    
    return doses;
  }

  // Check if dose was taken at specific time
  isDoseTakenAtTime(medicine, doseTime) {
    if (!medicine.dosesTaken || !Array.isArray(medicine.dosesTaken)) {
      return false;
    }
    
    const doseHour = doseTime.getHours();
    
    return medicine.dosesTaken.some(dose => {
      const takenDate = new Date(dose.takenAt);
      const takenHour = takenDate.getHours();
      const timeDiff = Math.abs(takenHour - doseHour);
      
      return takenDate.toDateString() === doseTime.toDateString() && timeDiff <= 1;
    });
  }

  // Setup periodic refresh
  setupPeriodicRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(() => {
      this.refreshUI();
    }, 60000);
  }

  // Show toast notification
  showToast(message, type) {
    if (type === undefined) type = 'success';
    const container = document.getElementById('toast-container') || document.body;
    
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.setAttribute('role', 'alert');
    
    let iconClass = 'check-circle';
    if (type === 'error') iconClass = 'exclamation-circle';
    else if (type === 'info') iconClass = 'info-circle';
    
    toast.innerHTML = '<i class="fas fa-' + iconClass + '"></i><span>' + message + '</span>';
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // Cleanup
  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    if (this.notifications && typeof this.notifications.destroy === 'function') {
      this.notifications.destroy();
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MedControleApp();
});

// Make app globally available for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MedControleApp };
} else {
  window.MedControleApp = MedControleApp;
}
