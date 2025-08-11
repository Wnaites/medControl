// Main application controller
class MedControleApp {
  constructor() {
    this.ui = new UIManager();
    this.storage = storage;
    this.notifications = notificationManager;
    
    this.init();
  }

  init() {
    // Register service worker
    this.registerServiceWorker();
    
    // Initialize app
    this.refreshUI();
    
    // Check for notification permission
    this.checkNotificationPermission();
    
    // Setup periodic refresh
    this.setupPeriodicRefresh();
  }

  // Register service worker for PWA
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registrado com sucesso:', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          console.log('Nova versão disponível');
        });
      } catch (error) {
        console.log('Falha ao registrar Service Worker:', error);
      }
    }
  }

  // Check notification permission
  async checkNotificationPermission() {
    const permission = await this.notifications.checkPermission();
    
    if (permission === 'default') {
      // Show permission modal after a delay
      setTimeout(() => {
        document.getElementById('notification-modal').style.display = 'block';
      }, 2000);
    }
  }

  // Refresh all UI elements
  refreshUI() {
    this.refreshMedicinesList();
    this.updateDashboard();
    this.updateNextDoses();
  }

  // Refresh medicines list
  refreshMedicinesList() {
    const medicines = this.storage.getMedicines();
    const container = document.getElementById('medicines-list');
    
    if (medicines.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-pills fa-3x"></i>
          <h3>Nenhum remédio cadastrado</h3>
          <p>Clique no botão "Novo Remédio" para começar</p>
        </div>
      `;
      return;
    }

    container.innerHTML = medicines.map(medicine => this.createMedicineCard(medicine)).join('');
    
    // Add event listeners to action buttons
    this.addMedicineCardListeners();
  }

  // Create medicine card HTML
  createMedicineCard(medicine) {
    const status = this.getMedicineStatus(medicine);
    const nextDose = this.getNextDose(medicine);
    const endDate = this.calculateEndDate(medicine);
    
    return `
      <div class="medicine-card ${status.class}" data-medicine-id="${medicine.id}">
        <div class="medicine-header">
          <div>
            <h3 class="medicine-name">${medicine.name}</h3>
            <p class="medicine-dosage">${medicine.dosage}</p>
          </div>
          <span class="medicine-status ${status.class}">${status.text}</span>
        </div>
        
        <div class="medicine-info">
          <div class="info-item">
            <span class="info-label">Próxima dose:</span>
            <span class="info-value">${nextDose}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Frequência:</span>
            <span class="info-value">${this.formatFrequency(medicine)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Término:</span>
            <span class="info-value">${endDate}</span>
          </div>
        </div>
        
        <div class="medicine-actions">
          <button class="btn-primary btn-small take-dose-btn" data-medicine-id="${medicine.id}">
            <i class="fas fa-check"></i> Tomei
          </button>
          <button class="btn-secondary btn-small edit-medicine-btn" data-medicine-id="${medicine.id}">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn-secondary btn-small delete-medicine-btn" data-medicine-id="${medicine.id}">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </div>
      </div>
    `;
  }

  // Get medicine status
  getMedicineStatus(medicine) {
    const now = new Date();
    const lastDoseTime = this.getLastDoseTime(medicine);
    
    if (lastDoseTime < now && !this.isDoseTakenToday(medicine)) {
      return { class: 'overdue', text: 'Atrasado' };
    } else if (this.isDoseTakenToday(medicine)) {
      return { class: 'completed', text: 'Tomado' };
    } else {
      return { class: 'active', text: 'Ativo' };
    }
  }

  // Get next dose time
  getNextDose(medicine) {
    const now = new Date();
    const [hours, minutes] = medicine.time.split(':');
    
    const nextDose = new Date();
    nextDose.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    if (nextDose < now) {
      nextDose.setDate(nextDose.getDate() + 1);
    }
    
    return nextDose.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
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
    switch (medicine.frequencyType) {
      case 'daily':
        return 'Diariamente';
      case 'specific-days':
        const days = medicine.specificDays || [];
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return days.map(d => dayNames[d]).join(', ');
      case 'weekly':
        return 'Semanalmente';
      case 'custom':
        return `A cada ${medicine.customInterval} horas`;
      default:
        return medicine.frequencyType;
    }
  }

  // Get last dose time
  getLastDoseTime(medicine) {
    const [hours, minutes] = medicine.time.split(':');
    const doseTime = new Date();
    doseTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return doseTime;
  }

  // Check if dose was taken today
  isDoseTakenToday(medicine) {
    if (!medicine.dosesTaken) return false;
    
    const today = new Date().toDateString();
    return medicine.dosesTaken.some(dose => 
      new Date(dose.takenAt).toDateString() === today
    );
  }

  // Add event listeners to medicine cards
  addMedicineCardListeners() {
    // Take dose button
    document.querySelectorAll('.take-dose-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const medicineId = e.target.dataset.medicineId;
        this.takeDose(medicineId);
      });
    });

    // Edit medicine button
    document.querySelectorAll('.edit-medicine-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const medicineId = e.target.dataset.medicineId;
        this.editMedicine(medicineId);
      });
    });

    // Delete medicine button
    document.querySelectorAll('.delete-medicine-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const medicineId = e.target.dataset.medicineId;
        this.deleteMedicine(medicineId);
      });
    });
  }

  // Take dose action
  takeDose(medicineId) {
    const medicine = this.storage.getMedicine(medicineId);
    if (medicine) {
      this.storage.markDoseTaken(medicineId, new Date());
      this.refreshUI();
      
      // Show confirmation
      this.showToast('Dose registrada com sucesso!');
    }
  }

  // Edit medicine
  editMedicine(medicineId) {
    const medicine = this.storage.getMedicine(medicineId);
    if (medicine) {
      this.ui.openAddMedicineModal(medicine);
    }
  }

  // Delete medicine
  deleteMedicine(medicineId) {
    if (confirm('Tem certeza que deseja excluir este remédio?')) {
      this.storage.deleteMedicine(medicineId);
      this.notifications.cancelMedicineNotifications(medicineId);
      this.refreshUI();
      this.showToast('Remédio excluído com sucesso!');
    }
  }

  // Update dashboard
  updateDashboard() {
    const medicines = this.storage.getMedicines();
    const todayDoses = this.storage.getTodayDoses();
    const overdueMedicines = this.storage.getOverdueMedicines();
    
    document.getElementById('total-medicines').textContent = medicines.length;
    document.getElementById('today-doses').textContent = todayDoses.length;
    document.getElementById('pending-doses').textContent = overdueMedicines.length;
  }

  // Update next doses display
  updateNextDoses() {
    const medicines = this.storage.getMedicines();
    const now = new Date();
    
    const upcomingDoses = medicines
      .map(medicine => ({
        medicine,
        nextDose: this.getNextDoseTime(medicine)
      }))
      .filter(item => item.nextDose > now)
      .sort((a, b) => a.nextDose - b.nextDose)
      .slice(0, 5);
    
    // Update next doses display if exists
    const nextDosesContainer = document.getElementById('next-doses');
    if (nextDosesContainer) {
      nextDosesContainer.innerHTML = upcomingDoses.map(item => `
        <div class="next-dose-item">
          <span>${item.medicine.name}</span>
          <span>${item.nextDose.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          })}</span>
        </div>
      `).join('');
    }
  }

  // Get next dose time
  getNextDoseTime(medicine) {
    const [hours, minutes] = medicine.time.split(':');
    const doseTime = new Date();
    doseTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    if (doseTime < new Date()) {
      doseTime.setDate(doseTime.getDate() + 1);
    }
    
    return doseTime;
  }

  // Setup periodic refresh
  setupPeriodicRefresh() {
    // Refresh every minute to update overdue status
    setInterval(() => {
      this.refreshUI();
    }, 60000);
  }

  // Show toast notification
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // Export data
  exportData() {
    this.storage.exportData();
  }

  // Import data
  async importData(file) {
    try {
      await this.storage.importData(file);
      this.refreshUI();
      this.showToast('Dados importados com sucesso!');
    } catch (error) {
      this.showToast('Erro ao importar dados: ' + error.message, 'error');
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MedControleApp();
});

// Make app globally available
window.MedControleApp = MedControleApp;

