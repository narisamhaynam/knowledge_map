document.addEventListener('DOMContentLoaded', function() {
    const path = window.location.pathname;
    
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === path) {
            link.classList.add('active');
        }
    });
    
    const yearElement = document.querySelector('.current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(message => {
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.className = 'close-button';
        closeButton.addEventListener('click', () => {
            message.remove();
        });
        message.appendChild(closeButton);
        
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                message.remove();
            }, 300);
        }, 5000);
    });
});


function showLoading(elementId, message = 'Loading...') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.innerHTML = `
        <div class="spinner"></div>
        <p>${message}</p>
    `;
    
    element.appendChild(spinner);
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const spinners = element.querySelectorAll('.loading-spinner');
    spinners.forEach(spinner => spinner.remove());
}

function formatDate(date, format = 'YYYY-MM-DD') {
    const d = new Date(date);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

function createModal(options) {
    const defaults = {
        title: 'Confirmation',
        content: 'Are you sure?',
        onConfirm: () => {},
        onCancel: () => {},
        confirmText: 'Confirm',
        cancelText: 'Cancel'
    };
    
    const settings = { ...defaults, ...options };
    
    const modalHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-container">
            <div class="modal-content">
                <h3 class="modal-title">${settings.title}</h3>
                <div class="modal-body">${settings.content}</div>
                <div class="modal-buttons">
                    <button class="secondary modal-cancel">${settings.cancelText}</button>
                    <button class="modal-confirm">${settings.confirmText}</button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    setTimeout(() => {
        modal.classList.add('visible');
    }, 10);
    
    const confirmButton = modal.querySelector('.modal-confirm');
    const cancelButton = modal.querySelector('.modal-cancel');
    const backdrop = modal.querySelector('.modal-backdrop');
    
    function closeModal() {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.remove();
        }, 300); 
    }
    
    confirmButton.addEventListener('click', () => {
        settings.onConfirm();
        closeModal();
    });
    
    cancelButton.addEventListener('click', () => {
        settings.onCancel();
        closeModal();
    });
    
    backdrop.addEventListener('click', () => {
        settings.onCancel();
        closeModal();
    });
    
    return modal;
}