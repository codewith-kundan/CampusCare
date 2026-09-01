/* ================================================================
   NITR CAMPUSCARE — EFFECTS ENGINE
   Professional utilities for Toasts, Modals, Mobile Nav, and Visuals.
================================================================ */

const CampusCare = (function() {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- DOM Loaded Setup ---
    document.addEventListener('DOMContentLoaded', () => {
        initReveal();
        initMobileNav();
    });

    // --- Scroll Reveal ---
    function initReveal() {
        const elements = document.querySelectorAll('[data-reveal]');
        if (!elements.length) return;

        if (prefersReducedMotion) {
            elements.forEach(el => el.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = entry.target.getAttribute('data-reveal-delay') || 0;
                    if (delay) {
                        setTimeout(() => entry.target.classList.add('is-visible'), parseInt(delay));
                    } else {
                        entry.target.classList.add('is-visible');
                    }
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: "0px 0px -20px 0px" });

        elements.forEach(el => observer.observe(el));
    }

    // --- Mobile Nav Drawer ---
    function initMobileNav() {
        const toggles = document.querySelectorAll('.mobile-nav-toggle');
        const menus = document.querySelectorAll('.navbar-nav');
        
        toggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                menus.forEach(menu => {
                    const isOpen = menu.classList.toggle('is-open');
                    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                });
            });
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.app-navbar')) {
                menus.forEach(menu => menu.classList.remove('is-open'));
                toggles.forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
            }
        });

        // Close on window resize to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                menus.forEach(menu => menu.classList.remove('is-open'));
                toggles.forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
            }
        });
    }

    // --- Toast Notifications ---
    function showToast(message, type = 'info', duration = 4000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        } else if (type === 'error') {
            iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        } else if (type === 'warning') {
            iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        } else {
            iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        }

        const titleText = type === 'info' ? 'Notification' : (type.charAt(0).toUpperCase() + type.slice(1));

        toast.innerHTML = `
            ${iconSvg}
            <div class="toast-content">
                <div class="toast-title">${titleText}</div>
                <div>${escapeText(message)}</div>
            </div>
            <button class="toast-close" aria-label="Close">&times;</button>
        `;

        container.appendChild(toast);
        
        // Trigger CSS transition
        requestAnimationFrame(() => {
            toast.classList.add('is-visible');
        });

        const remove = () => {
            toast.classList.remove('is-visible');
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        };

        const timer = setTimeout(remove, duration);
        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(timer);
            remove();
        });
    }

    // --- Modal Confirmation Dialog ---
    function showConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            
            const btnClass = danger ? 'btn-danger' : 'btn-primary';
            
            overlay.innerHTML = `
                <div class="modal-dialog">
                    <h3 class="mb-2" style="font-size: 1.25rem;">${escapeText(title)}</h3>
                    <p class="text-muted mb-6" style="font-size: 0.9375rem;">${escapeText(message)}</p>
                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn btn-ghost" id="modalCancelBtn">${escapeText(cancelLabel)}</button>
                        <button class="btn ${btnClass}" id="modalConfirmBtn">${escapeText(confirmLabel)}</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            requestAnimationFrame(() => {
                overlay.classList.add('is-visible');
            });

            const cleanup = () => {
                overlay.classList.remove('is-visible');
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                }, 250);
            };

            overlay.querySelector('#modalCancelBtn').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            overlay.querySelector('#modalConfirmBtn').addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    // --- Subtle Node Network Visual (2D Canvas) ---
    function initHeroVisual(canvas, options = {}) {
        if (!canvas || prefersReducedMotion) return;
        
        const ctx = canvas.getContext('2d');
        let width = 0;
        let height = 0;
        let animationFrameId;
        const nodes = [];
        const isMobile = window.innerWidth < 768;
        const numNodes = options.force2D ? (isMobile ? 20 : 35) : (isMobile ? 30 : 60);
        
        function resize() {
            width = canvas.width = canvas.offsetWidth || canvas.parentElement?.offsetWidth || window.innerWidth;
            height = canvas.height = canvas.offsetHeight || canvas.parentElement?.offsetHeight || 600;
        }
        window.addEventListener('resize', resize);
        resize();

        for (let i = 0; i < numNodes; i++) {
            nodes.push({
                x: Math.random() * (width || 800),
                y: Math.random() * (height || 600),
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                radius: Math.random() * 1.5 + 1.2
            });
        }

        function draw() {
            if (!width || !height) {
                resize();
            }

            ctx.clearRect(0, 0, width, height);
            
            // Draw connections
            ctx.lineWidth = 1;
            for (let i = 0; i < numNodes; i++) {
                for (let j = i + 1; j < numNodes; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 130) {
                        ctx.beginPath();
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        const opacity = (1 - dist / 130) * 0.22;
                        ctx.strokeStyle = `rgba(139, 30, 45, ${opacity})`;
                        ctx.stroke();
                    }
                }
            }

            // Draw nodes
            ctx.fillStyle = `rgba(15, 23, 42, 0.45)`;
            nodes.forEach(node => {
                node.x += node.vx;
                node.y += node.vy;
                
                if (node.x < 0 || node.x > width) node.vx *= -1;
                if (node.y < 0 || node.y > height) node.vy *= -1;

                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(draw);
        }
        
        draw();
    }

    function escapeText(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = String(str);
        return d.innerHTML;
    }

    return {
        toast: showToast,
        confirmDialog: showConfirmDialog,
        initHeroVisual: initHeroVisual
    };
})();

window.CampusCare = CampusCare;
