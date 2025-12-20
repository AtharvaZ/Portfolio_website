// Hover effect for interactive elements (optional check if we still want this class)
const interactiveElements = document.querySelectorAll('a, button, input, textarea, .project-card, .skill-item');
interactiveElements.forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
});

// Mobile Menu Toggle
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
        if(navLinks.style.display === 'flex') {
            navLinks.style.flexDirection = 'column';
            navLinks.style.position = 'absolute';
            navLinks.style.top = '80px';
            navLinks.style.left = '0';
            navLinks.style.width = '100%';
            navLinks.style.background = 'rgba(5, 5, 8, 0.95)';
            navLinks.style.padding = '2rem';
            navLinks.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        }
    });
}

// Hero Particles Animation
const canvas = document.getElementById('hero-particles');
if (canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particlesArray;

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2;
            this.speedX = (Math.random() * 0.5) - 0.25;
            this.speedY = (Math.random() * 0.5) - 0.25;
            // Updated colors for light theme (grey/blue)
            this.color = Math.random() > 0.5 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 0, 0, 0.1)';
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.size > 0.1) this.size -= 0.01; // Fade out slowly
            if (this.size <= 0.1) { // Reset
                 this.x = Math.random() * canvas.width;
                 this.y = Math.random() * canvas.height;
                 this.size = Math.random() * 2;
            }
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        particlesArray = [];
        for (let i = 0; i < 100; i++) {
            particlesArray.push(new Particle());
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
        }
        requestAnimationFrame(animateParticles);
    }

    initParticles();
    animateParticles();

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initParticles();
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // Hero Entrance Animations
    const heroElements = document.querySelectorAll('[data-animate]');
    heroElements.forEach((el, index) => {
        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        }, 300 + (index * 200));
    });

    // Typewriter Effect
    const typeWriterElement = document.getElementById('typewriter');
    if (typeWriterElement) {
        const phrases = ["Digital Products.", "Interactive Webs.", "Creative Solutions."];
        let phraseIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let typeSpeed = 100;

        function type() {
            const currentPhrase = phrases[phraseIndex];
            
            if (isDeleting) {
                typeWriterElement.textContent = currentPhrase.substring(0, charIndex - 1);
                charIndex--;
                typeSpeed = 50;
            } else {
                typeWriterElement.textContent = currentPhrase.substring(0, charIndex + 1);
                charIndex++;
                typeSpeed = 100;
            }

            if (!isDeleting && charIndex === currentPhrase.length) {
                isDeleting = true;
                typeSpeed = 2000;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                phraseIndex = (phraseIndex + 1) % phrases.length;
                typeSpeed = 500;
            }

            setTimeout(type, typeSpeed);
        }
        // Start after a delay
        setTimeout(type, 1500);
    }

    // Skills Rendering
    const skills = [
        "HTML5", "CSS3", "JavaScript", "React.js", 
        "Node.js", "Three.js", "WebGL", "Git", "Figma"
    ];

    const skillsContainer = document.getElementById('skills-wrapper');
    if (skillsContainer) {
        skills.forEach(skill => {
            const skillEl = document.createElement('div');
            skillEl.className = 'skill-item';
            skillEl.textContent = skill;
            skillsContainer.appendChild(skillEl);
        });
    }
});


// Scroll Observer
const observerOptions = {
    threshold: 0.1
};

const Observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            entry.target.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
            Observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.scroll-reveal').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(50px)';
    Observer.observe(el);
});

// Removed 3D Tilt for cleaner performance
