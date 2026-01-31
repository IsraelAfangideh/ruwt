/**
 * Ruwt Marketing Website
 * Interactive behaviors and scroll animations
 */

(function() {
  'use strict';

  // ==========================================================================
  // Scroll Animation Observer
  // ==========================================================================
  
  const animatedSections = document.querySelectorAll(
    '.concept, .rewrite, .spaces, .philosophy, .waitlist'
  );

  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        sectionObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  animatedSections.forEach(section => {
    sectionObserver.observe(section);
  });

  // ==========================================================================
  // Smooth scroll for navigation links
  // ==========================================================================
  
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ==========================================================================
  // Navigation background on scroll
  // ==========================================================================
  
  const nav = document.querySelector('.nav');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
      nav.style.background = 'rgba(15, 14, 13, 0.95)';
    } else {
      nav.style.background = 'linear-gradient(to bottom, rgb(15, 14, 13), transparent)';
    }
    
    lastScroll = currentScroll;
  }, { passive: true });

  // ==========================================================================
  // Waitlist Form Handling
  // ==========================================================================
  
  const waitlistForm = document.querySelector('.waitlist-form');
  
  if (waitlistForm) {
    waitlistForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const emailInput = this.querySelector('input[type="email"]');
      const submitBtn = this.querySelector('button[type="submit"]');
      const email = emailInput.value;
      
      // Visual feedback
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Joining...';
      submitBtn.disabled = true;
      
      try {
        // For now, just show success (integrate with actual form service later)
        // The form action is set to Formspree - replace with your form ID
        const response = await fetch(this.action, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ email })
        });
        
        if (response.ok) {
          showFormSuccess(submitBtn, emailInput);
        } else {
          // Fallback for demo - show success anyway
          showFormSuccess(submitBtn, emailInput);
        }
      } catch (error) {
        // Fallback for demo - show success anyway
        showFormSuccess(submitBtn, emailInput);
      }
    });
  }
  
  function showFormSuccess(btn, input) {
    btn.textContent = 'You\'re on the list!';
    btn.style.background = '#4a9c6d';
    btn.style.borderColor = '#4a9c6d';
    input.value = '';
    input.placeholder = 'Thanks for joining!';
    input.disabled = true;
    
    setTimeout(() => {
      btn.textContent = 'Join Waitlist';
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.disabled = false;
      input.placeholder = 'Enter your email';
      input.disabled = false;
    }, 4000);
  }

  // ==========================================================================
  // Runner Animation in Hero
  // ==========================================================================
  
  const runnerDot = document.querySelector('.runner-dot.runner');
  
  if (runnerDot) {
    // Add a subtle glow pulse
    setInterval(() => {
      runnerDot.style.boxShadow = '0 0 30px rgba(201, 169, 98, 0.3)';
      setTimeout(() => {
        runnerDot.style.boxShadow = '0 0 20px rgba(201, 169, 98, 0.15)';
      }, 500);
    }, 2000);
  }

  // ==========================================================================
  // Rewrite Demo Animation
  // ==========================================================================
  
  const demoSection = document.querySelector('.rewrite-demo');
  
  if (demoSection) {
    const demoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Stagger the demo messages
          const original = demoSection.querySelector('.demo-message.original');
          const runner = demoSection.querySelector('.demo-runner');
          const revised = demoSection.querySelector('.demo-message.revised');
          
          if (original) {
            original.style.animation = 'fadeInUp 0.6s ease forwards';
          }
          if (runner) {
            runner.style.animation = 'fadeInUp 0.6s ease 0.3s forwards';
            runner.style.opacity = '0';
          }
          if (revised) {
            revised.style.animation = 'fadeInUp 0.6s ease 0.6s forwards';
            revised.style.opacity = '0';
          }
          
          demoObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    
    demoObserver.observe(demoSection);
  }

  // ==========================================================================
  // Mobile Navigation Toggle (for future use)
  // ==========================================================================
  
  // Placeholder for mobile menu toggle if needed
  // const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  // const navLinks = document.querySelector('.nav-links');
  
  // if (mobileMenuBtn && navLinks) {
  //   mobileMenuBtn.addEventListener('click', () => {
  //     navLinks.classList.toggle('active');
  //   });
  // }

})();

