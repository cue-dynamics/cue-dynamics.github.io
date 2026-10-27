// Scramble text animation
	// ========================





	window.addEventListener("DOMContentLoaded", () => {
  
  
/*

	var CHARS = `.,'^":;Il!i><~+-_?][}{1)(|\tf/jrxnuvcXZYUJCLQ0OZmwqpdbkhao*#MW&8%B@$`;

  const scramble = document.querySelectorAll(".text-animated");
  
  // Function to lock dimensions
  function lockDimensions(heading) {
    // Temporarily ensure text is in final state to measure
    const originalText = heading.textContent;
    heading.textContent = originalText; // Ensure it's the final text
    
    const width = heading.offsetWidth;
    const height = heading.offsetHeight;
    
    heading.style.width = `${width}px`;
    heading.style.height = `${height}px`;
    heading.style.display = 'inline-block';
    heading.style.overflow = 'hidden'; // Prevent any overflow during scramble
  }
  
  // Lock all dimensions on load
  scramble.forEach((heading) => {
    lockDimensions(heading);
    
    gsap.to(heading, {
      duration: 1,
      scrambleText: {
        speed: 0.1,
        text: "{original}",
        chars: CHARS,
        revealDelay: 0.1
      },
      scrollTrigger: {
        trigger: heading,
        start: "top 80%",
        toggleActions: "play none none none"
      }
    });
  });
  
  // Debounced resize handler
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      scramble.forEach((heading) => {
        // Temporarily remove fixed dimensions to re-measure
        heading.style.width = '';
        heading.style.height = '';
        
        // Re-lock with new dimensions
        lockDimensions(heading);
      });
    }, 250); // Debounce by 250ms
  });
  
  */
  
  
  // Quote Animations
  // ================
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        } else {
          // Optional: remove active class when out of viewport
          entry.target.classList.remove('active');
        }
      });
    }, {
      // Options
      threshold: 0.3, // Trigger when 30% of element is visible
      rootMargin: '0px 0px -100px 0px' // Trigger 100px before reaching bottom of viewport
    });

    // Observe all elements with class "quote"
    document.querySelectorAll('.quote').forEach(quote => {
      observer.observe(quote);
    });
    


	// Site Navitation visibility toggle
	// =================================
    
  const logo = document.getElementById('logo_general_intuition');
  const footer = document.getElementById('footer');
  const body = document.body;

  if (logo && footer) {
    //console.log("logo and footer found");

    let logoVisible = false;
    let footerVisible = false;
    let updateTimeout = null;

    // Debounced update function to prevent flickering
    function updateNavVisibility() {
      // Clear any pending updates
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }

      // Small delay to batch rapid scroll events
      updateTimeout = setTimeout(() => {
        if (!logoVisible && !footerVisible) {
          //console.log("neither logo nor footer visible - showing nav");
          body.classList.add('nav-open');
        } else {
          //console.log("logo or footer visible - hiding nav");
          body.classList.remove('nav-open');
        }
      }, 50); // 50ms debounce
    }

    const logoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        logoVisible = entry.isIntersecting;
        if (logoVisible) {
          //console.log("logo intersecting");
        } else {
          //console.log("logo not intersecting");
        }
        updateNavVisibility();
      });
    }, {
      threshold: 0,
      rootMargin: '20px 0px 0px 0px'
    });

    const footerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        footerVisible = entry.isIntersecting;
        if (footerVisible) {
          //console.log("footer intersecting");
        } else {
          //console.log("footer not intersecting");
        }
        updateNavVisibility();
      });
    }, {
      threshold: 0,
      rootMargin: '0px 0px 20px 0px'
    });

    logoObserver.observe(logo);
    footerObserver.observe(footer);
  } else {
    //console.log("logo or footer element not found");
  }


});
