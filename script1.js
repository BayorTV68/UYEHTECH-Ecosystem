        const contactForm = document.getElementById('contactForm');
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const subject = document.getElementById('subject').value;
            const message = document.getElementById('message').value;
            
            alert('Thank you ' + name + '! Your message has been received. Message our WhatsApp link for quick response!');
            
            this.reset();
        });
        
        const backToTop = document.getElementById('backToTop');
        
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
                backToTop.classList.add('show');
            } else {
                backToTop.classList.remove('show');
            }
        });
        
        backToTop.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });




// Focus search bar with Ctrl+K or Cmd+K (like modern apps)
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
    }
});   

      // ========== NEWSLETTER FUNCTIONALITY ==========

// Main Newsletter Form Handler
const newsletterForm = document.getElementById('newsletterForm');
const newsletterSuccess = document.getElementById('newsletterSuccess');

if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(this);
        const name = formData.get('name');
        const email = formData.get('email');
        
        // Show loading state
        const submitBtn = this.querySelector('.newsletter-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>Subscribing...</span>';
        submitBtn.disabled = true;
        
        // Send to Formspree (or your email service)
        fetch(this.action, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                // Success!
                newsletterForm.style.display = 'none';
                newsletterSuccess.style.display = 'block';
                
                // Save to localStorage (prevent multiple popups)
                localStorage.setItem('newsletter_subscribed', 'true');
                
                // Optional: Google Analytics tracking
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'newsletter_signup', {
                        'event_category': 'engagement',
                        'event_label': email
                    });
                }
            } else {
                throw new Error('Subscription failed');
            }
        })
        .catch(error => {
            alert('Oops! Something went wrong. Please try again.');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        });
    });
}

// ========================================
// POPUP NEWSLETTER FUNCTIONALITY
// ========================================

const newsletterPopup = document.getElementById('newsletterPopup');
const closePopupBtn = document.getElementById('closePopup');
const popupForm = document.getElementById('popupNewsletterForm');

// Show popup after 30 seconds (if not already subscribed)
function showNewsletterPopup() {
    const hasSubscribed = localStorage.getItem('newsletter_subscribed');
    const hasSeenPopup = sessionStorage.getItem('newsletter_popup_shown');
    
    if (!hasSubscribed && !hasSeenPopup) {
        setTimeout(() => {
            newsletterPopup.classList.add('active');
            sessionStorage.setItem('newsletter_popup_shown', 'true');
        }, 30000); // 30 seconds
    }
}

// Close popup
if (closePopupBtn) {
    closePopupBtn.addEventListener('click', function() {
        newsletterPopup.classList.remove('active');
    });
}

// Close popup when clicking outside
if (newsletterPopup) {
    newsletterPopup.addEventListener('click', function(e) {
        if (e.target === newsletterPopup) {
            newsletterPopup.classList.remove('active');
        }
    });
}

// Handle popup form submission
if (popupForm) {
    popupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = this.querySelector('input[name="email"]').value;
        const submitBtn = this.querySelector('button');
        submitBtn.textContent = 'Subscribing...';
        submitBtn.disabled = true;
        
        // Simulate submission (replace with actual API call)
        setTimeout(() => {
            newsletterPopup.classList.remove('active');
            localStorage.setItem('newsletter_subscribed', 'true');
            
            // Show success message
            alert('Thank you for subscribing! Check your email to confirm.');
            
            submitBtn.textContent = 'Subscribe Now';
            submitBtn.disabled = false;
            this.reset();
        }, 1500);
    });
}

// Initialize popup on page load
document.addEventListener('DOMContentLoaded', function() {
    // Uncomment to enable auto-popup after 30 seconds
    // showNewsletterPopup();
});

// ========================================
// COMPACT NEWSLETTER FORM
// ========================================

const compactForm = document.getElementById('compactNewsletterForm');

if (compactForm) {
    compactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = this.querySelector('input[name="email"]').value;
        const submitBtn = this.querySelector('button');
        const originalText = submitBtn.textContent;
        
        submitBtn.textContent = 'Subscribing...';
        submitBtn.disabled = true;
        
        // Simulate submission
        setTimeout(() => {
            alert('Thank you for subscribing!');
            localStorage.setItem('newsletter_subscribed', 'true');
            this.reset();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 1500);
    });
}

// ========================================
// EXIT-INTENT POPUP (ADVANCED)
// ========================================

let exitPopupShown = false;

function showExitIntentPopup(e) {
    const hasSubscribed = localStorage.getItem('newsletter_subscribed');
    
    // Detect mouse leaving viewport from top
    if (!exitPopupShown && !hasSubscribed && e.clientY < 10) {
        newsletterPopup.classList.add('active');
        exitPopupShown = true;
        
        // Remove event listener after showing once
        document.removeEventListener('mouseout', showExitIntentPopup);
    }
}

// Uncomment to enable exit-intent popup
// document.addEventListener('mouseout', showExitIntentPopup);

// ========================================
// SCROLL TRIGGER (Show after scrolling 50%)
// ========================================

let scrollPopupShown = false;

window.addEventListener('scroll', function() {
    const hasSubscribed = localStorage.getItem('newsletter_subscribed');
    const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    
    if (!scrollPopupShown && !hasSubscribed && scrollPercent > 50) {
        newsletterPopup.classList.add('active');
        scrollPopupShown = true;
    }
});

// ========================================
// HELPER: Email Validation
// ========================================

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Add real-time email validation to all newsletter forms
document.querySelectorAll('input[type="email"]').forEach(input => {
    input.addEventListener('blur', function() {
        if (this.value && !validateEmail(this.value)) {
            this.style.borderColor = '#ff4444';
            this.setCustomValidity('Please enter a valid email address');
        } else {
            this.style.borderColor = '#333';
            this.setCustomValidity('');
        }
    });
});


  // === Fade Cycle Animation ===
  const marqueeTexts = document.querySelectorAll('.uyeh-header-marquee .marquee-text');
  let i = 0;

  setInterval(() => {
    marqueeTexts[i].classList.remove('active');
    i = (i + 1) % marqueeTexts.length;
    marqueeTexts[i].classList.add('active');
  }, 3000); // Switch text every 3 seconds
