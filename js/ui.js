// UI module for handling user interface interactions
class UIManager {
  constructor() {
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Add medicine button
    document.getElementById('add-medicine-btn').addEventListener('click', () => {
      this.openAddMedicineModal();
    });

    // Close modal buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeModal();
      });
    });

    // Form submission
    const form = document.getElementById('medicine-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleMedicineFormSubmit();
      });
    }

    // Frequency type change
    const frequencyTypeSelect = document.getElementById('frequency-type');
    if (frequencyTypeSelect) {
      frequencyTypeSelect.addEventListener('change', (e) => {
        this.updateFrequencyOptions(e.target.value);
      });
    }

    // Click outside modal to close
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeModal();
      }
    });
  }

  // Open add medicine modal
  openAddMedicineModal(medicine = null) {
    const modal = document.getElementById('medicine-modal');
    const form = document.getElementById('medicine-form');
    
    // Reset form
    form.reset();
    
    if (medicine) {
      // Edit mode
      document.getElementById('medicine-name').value = medicine.name;
      document.getElementById('medicine-dosage').value = medicine.dosage;
      document.getElementById('frequency-type').value = medicine.frequencyType;
      document.getElementById('start-date').value = medicine.startDate;
      document.getElementById('duration-days').value = medicine.durationDays;
      document.getElementById('time').value = medicine.time;
      
      form.dataset.medicineId = medicine.id;
      modal.querySelector('h3').textContent = 'Editar Remédio';
    } else {
      // Add mode
      delete form.dataset.medicineId;
      modal.querySelector('h3').textContent = 'Adicionar Novo Remédio';
      document.getElementById('start-date').value = new Date().toISOString().split('T')[0];
    }
    
    this.updateFrequencyOptions(document.getElementById('frequency-type').value);
    modal.style.display = 'block';
  }

  // Close modal
  closeModal() {
    document.getElementById('medicine-modal').style.display = 'none';
    document.getElementById('notification-modal').style.display = 'none';
  }

  // Update frequency options based on selection
  updateFrequencyOptions(frequencyType) {
    const container = document.getElementById('frequency-options');
    container.innerHTML = '';
    
    switch (frequencyType) {
      case 'specific-days':
        container.innerHTML = `
          <div class="form-group">
            <label>Dias da semana</label>
            <div class="checkbox-group">
              <label><input type="checkbox" value="0" name="specific-days"> Domingo</label>
              <label><input type="checkbox" value="1" name="specific-days"> Segunda</label>
              <label><input type="checkbox" value="2" name="specific-days"> Terça</label>
              <label><input type="checkbox" value="3" name="specific-days"> Quarta</label>
              <label><input type="checkbox" value="4" name="specific-days"> Quinta</label>
              <label><input type="checkbox" value="5" name="specific-days"> Sexta</label>
              <label><input type="checkbox" value="6" name="specific-days"> Sábado</label>
            </div>
          </div>
        `;
        break;
      case 'custom':
        container.innerHTML = `
          <div class="form-group">
            <label>Intervalo (horas)</label>
            <input type="number" id="custom-interval" min="1" max="24" placeholder="Ex: 8">
          </div>
        `;
        break;
      default:
        container.innerHTML = '';
    }
  }

  // Handle form submission
  handleMedicineFormSubmit() {
    const form = document.getElementById('medicine-form');
    const formData = new FormData(form);
    
    const medicine = {
      name: formData.get('medicine-name'),
      dosage: formData.get('medicine-dosage'),
      frequencyType: formData.get('frequency-type'),
      startDate: formData.get('start-date'),
      durationDays: formData.get('duration-days'),
      time: formData.get('time')
    };
    
    // Handle specific days
    if (medicine.frequencyType === 'specific-days') {
      const checkboxes = document.querySelectorAll('input[name="specific-days"]:checked');
      medicine.specificDays = Array.from(checkboxes).map(cb => parseInt(cb.value));
    }
    
    // Handle custom interval
    if (medicine.frequencyType === 'custom') {
      medicine.customInterval = document.getElementById('custom-interval').value;
    }
    
    // Add ID if editing
    if (form.dataset.medicineId) {
      medicine.id = form.dataset.medicineId;
      // Update existing medicine
      storage.saveMedicine(medicine);
    } else {
      // Add new medicine
      storage.saveMedicine(medicine);
    }
    
    // Refresh UI
    this.refreshMedicinesList();
    this.updateDashboard();
    
    // Schedule notifications
    notificationManager.scheduleMedicineNotifications(medicine);
    
    // Close modal
    this.closeModal();
  }

  // Refresh medicines list
  refreshMedicinesList() {
    const medicines = storage.getMedicines();
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

  // Update dashboard
  updateDashboard() {
    const medicines = storage.getMedicines();
    const todayDoses = storage.getTodayDoses();
    const overdueMedicines = storage.getOverdueMedicines();
    
    document.getElementById('total-medicines').textContent = medicines.length;
    document.getElementById('today-doses').textContent = todayDoses.length;
    document.getElementById('pending-doses').textContent = overdueMedicines.length;
  }
}

// Create global instance
window.ui = new UIManager();
