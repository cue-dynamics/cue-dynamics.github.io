// Function to open modal with specific content and body scroll lock
function openModal(articleId) {
  
  const body = document.body;
  const modalScroll = document.querySelector(".modal-scroll")
  const targetArticle = document.getElementById(articleId);
    
  
  if (!body || !targetArticle) {
    console.error('Body or target content not found');
    return;
  }
    
  const modal = document.getElementById('modal');
  const allArticleDivs = modal.querySelectorAll('.article-wrapper');
  allArticleDivs.forEach(div => {
    div.style.display = 'none';
  });
  
  targetArticle.style.display = 'block';      
  
  modalScroll.scrollTop = 0;
  if (modalScroll.scrollTo) modalScroll.scrollTo({ top: 0, left: 0 });
    
  body.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  bodyScrollLock.disableBodyScroll(modalScroll);
}


function closeModal() {

  const body = document.body;
    
  if (!body) {
    console.error('Body Element not found');
    return;
  }
    
  body.classList.remove('modal-open');
  document.getElementById('modal').setAttribute('aria-hidden', 'true');
  bodyScrollLock.clearAllBodyScrollLocks();
}


document.querySelector('#button1').addEventListener('click', (event) => {
  event.preventDefault();
  openModal('modal-article-1');
});



// Close button or overlay click
document.querySelector('#modal-close-button').addEventListener('click', (event) => {
  event.preventDefault();
  closeModal();
});
document.querySelector('#modal-close-bar').addEventListener('click', (event) => {
  event.preventDefault();
  closeModal();
});

// Close modal on escape key press
document.addEventListener('keydown', (e) => {

  const body = document.body;

// Check if modal is currently active
  if (body && body.classList.contains('modal-open')) {
    // Close on Escape, or other common "cancel" keys
    if (e.key === 'Escape' || 
        e.key === 'Esc' || 
        e.keyCode === 27) {
      e.preventDefault();
      closeModal();
    }
  }
});
