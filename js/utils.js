// Shared utility functions for MedControle
// These functions are pure and can be easily tested

/**
 * Calculate end date based on start date and duration
 * @param {string} startDate - ISO date string
 * @param {number} durationDays - Duration in days
 * @returns {Date} End date
 */
export function calculateEndDate(startDate, durationDays) {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + parseInt(durationDays));
  return end;
}

/**
 * Format date to Brazilian locale
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDateBR(date) {
  return date.toLocaleDateString('pt-BR');
}

/**
 * Format time to Brazilian locale (HH:MM)
 * @param {Date} date - Date with time
 * @returns {string} Formatted time
 */
export function formatTimeBR(date) {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get next dose time for a medicine
 * @param {Object} medicine - Medicine object
 * @returns {Date} Next dose date/time
 */
export function getNextDoseTime(medicine) {
  const now = new Date();
  const [hours, minutes] = medicine.time.split(':');
  
  const nextDose = new Date();
  nextDose.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  if (nextDose < now) {
    nextDose.setDate(nextDose.getDate() + 1);
  }
  
  return nextDose;
}

/**
 * Get all dose times for a medicine within a specific day
 * This is crucial for custom frequency medications
 * @param {Object} medicine - Medicine object
 * @param {Date} targetDate - Date to get doses for (defaults to today)
 * @returns {Date[]} Array of dose times for the day
 */
export function getDosesForDay(medicine, targetDate = new Date()) {
  const doses = [];
  const start = new Date(medicine.startDate);
  const end = calculateEndDate(medicine.startDate, medicine.durationDays);
  
  // Check if targetDate is within medicine period
  const targetStart = new Date(targetDate);
  targetStart.setHours(0, 0, 0, 0);
  const targetEnd = new Date(targetDate);
  targetEnd.setHours(23, 59, 59, 999);
  
  if (targetStart < start || targetStart > end) {
    return doses; // Outside medicine period
  }
  
  // Check if dose should occur on this day based on frequency
  if (!shouldDoseOnDay(medicine, targetDate)) {
    return doses;
  }
  
  // Generate all doses for this day based on frequency type
  switch (medicine.frequencyType) {
    case 'daily':
    case 'specific-days':
    case 'weekly':
      // Single daily dose at specified time
      doses.push(createDoseTime(targetDate, medicine.time));
      break;
      
    case 'custom':
      // Multiple doses per day based on interval
      const interval = parseInt(medicine.customInterval) || 8;
      const dosesPerDay = Math.floor(24 / interval);
      
      for (let i = 0; i < dosesPerDay; i++) {
        const doseTime = new Date(targetStart);
        doseTime.setHours(i * interval, 0, 0, 0);
        
        // Only add if it's not in the past
        if (doseTime >= new Date()) {
          doses.push(doseTime);
        }
      }
      break;
  }
  
  return doses;
}

/**
 * Check if a medicine should have a dose on a specific day
 * @param {Object} medicine - Medicine object
 * @param {Date} date - Date to check
 * @returns {boolean} True if dose should occur on this day
 */
export function shouldDoseOnDay(medicine, date) {
  const dayOfWeek = date.getDay();
  const start = new Date(medicine.startDate);
  const end = calculateEndDate(medicine.startDate, medicine.durationDays);
  
  // Check if date is within medicine period
  if (date < start || date > end) {
    return false;
  }
  
  // Check frequency-specific rules
  switch (medicine.frequencyType) {
    case 'daily':
      return true;
      
    case 'specific-days':
      const specificDays = medicine.specificDays || [];
      return specificDays.includes(dayOfWeek);
      
    case 'weekly':
      // Weekly means same day of week as start date
      return dayOfWeek === start.getDay();
      
    case 'custom':
      // Custom frequency - every N hours, every day
      return true;
      
    default:
      return false;
  }
}

/**
 * Create a date object with specific time on a given date
 * @param {Date} date - Base date
 * @param {string} time - Time string (HH:MM)
 * @returns {Date} Date with specified time
 */
export function createDoseTime(date, time) {
  const [hours, minutes] = time.split(':');
  const doseTime = new Date(date);
  doseTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return doseTime;
}

/**
 * Format frequency description for display
 * @param {Object} medicine - Medicine object
 * @returns {string} Formatted frequency description
 */
export function formatFrequency(medicine) {
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
      return `${dosesPerDay}x ao dia (a cada ${interval}h)`;
      
    default:
      return medicine.frequencyType;
  }
}

/**
 * Calculate number of doses per day
 * @param {Object} medicine - Medicine object
 * @returns {number} Number of doses per day
 */
export function getDosesPerDay(medicine) {
  switch (medicine.frequencyType) {
    case 'daily':
    case 'specific-days':
    case 'weekly':
      return 1;
      
    case 'custom':
      const interval = parseInt(medicine.customInterval) || 8;
      return Math.floor(24 / interval);
      
    default:
      return 1;
  }
}

/**
 * Get next dose information including all remaining doses for today
 * @param {Object} medicine - Medicine object
 * @returns {Object} Next dose information
 */
export function getNextDoseInfo(medicine) {
  const now = new Date();
  const todayDoses = getDosesForDay(medicine, now);
  
  // Find next dose that hasn't passed yet
  const nextDose = todayDoses.find(dose => dose > now);
  
  if (nextDose) {
    return {
      nextDose,
      isToday: true,
      remainingToday: todayDoses.filter(d => d > now).length
    };
  }
  
  // No more doses today, get tomorrow's first dose
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDoses = getDosesForDay(medicine, tomorrow);
  
  return {
    nextDose: tomorrowDoses[0] || null,
    isToday: false,
    remainingToday: 0
  };
}

/**
 * Check if dose was taken today
 * @param {Object} medicine - Medicine object
 * @returns {boolean} True if dose was taken today
 */
export function isDoseTakenToday(medicine) {
  if (!medicine.dosesTaken || !Array.isArray(medicine.dosesTaken)) {
    return false;
  }
  
  const today = new Date().toDateString();
  return medicine.dosesTaken.some(dose => 
    new Date(dose.takenAt).toDateString() === today
  );
}

/**
 * Get medicine status (active, overdue, completed)
 * @param {Object} medicine - Medicine object
 * @returns {Object} Status object with class and text
 */
export function getMedicineStatus(medicine) {
  const now = new Date();
  const nextDoseInfo = getNextDoseInfo(medicine);
  
  if (!nextDoseInfo.nextDose) {
    return { class: 'inactive', text: 'Inativo' };
  }
  
  const hasTakenToday = isDoseTakenToday(medicine);
  const isPastDue = nextDoseInfo.nextDose < now;
  
  if (hasTakenToday && medicine.frequencyType !== 'custom') {
    return { class: 'completed', text: 'Tomado' };
  }
  
  if (isPastDue && !hasTakenToday) {
    return { class: 'overdue', text: 'Atrasado' };
  }
  
  return { class: 'active', text: 'Ativo' };
}

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Parse time string to hours and minutes
 * @param {string} time - Time string (HH:MM)
 * @returns {Object} Object with hours and minutes
 */
export function parseTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Add minutes to a date
 * @param {Date} date - Base date
 * @param {number} minutes - Minutes to add
 * @returns {Date} New date
 */
export function addMinutes(date, minutes) {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Check if two dates are on the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if same day
 */
export function isSameDay(date1, date2) {
  return date1.toDateString() === date2.toDateString();
}

/**
 * Get all scheduled doses for a medicine within its treatment period
 * This is useful for generating complete notification schedules
 * @param {Object} medicine - Medicine object
 * @returns {Date[]} Array of all scheduled dose times
 */
export function getAllScheduledDoses(medicine) {
  const doses = [];
  const start = new Date(medicine.startDate);
  const end = calculateEndDate(medicine.startDate, medicine.durationDays);
  const now = new Date();
  
  // Iterate through each day of treatment
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    // Skip if day doesn't match frequency
    if (!shouldDoseOnDay(medicine, date)) {
      continue;
    }
    
    // Get doses for this day
    const dayDoses = getDosesForDay(medicine, date);
    
    // Only include future doses
    dayDoses.forEach(dose => {
      if (dose > now) {
        doses.push(dose);
      }
    });
  }
  
  return doses;
}
