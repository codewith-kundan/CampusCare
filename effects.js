/* ================================================================
   NITR CAMPUSCARE — SHARED INTERACTIVE LAYER
   Loaded on every page (after supabase, before the page script).
   Exposes window.CampusCare = { toast, confirmDialog, initHeroVisual }
================================================================ */

(function () {
    "use strict";

    const prefersReducedMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;


    // ============================================================
    // MOBILE NAV
    // ============================================================

    function initMobileNav() {

        const toggle = document.querySelector("[data-nav-toggle]");
        const menu = document.querySelector("[data-nav-menu]");

        if (!toggle || !menu) return;

        toggle.addEventListener("click", () => {

            const open = !menu.classList.contains("is-open");

            menu.classList.toggle("is-open", open);
            toggle.classList.toggle("is-open", open);
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
            document.body.classList.toggle("nav-locked", open);
        });

        menu.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                menu.classList.remove("is-open");
                toggle.classList.remove("is-open");
                document.body.classList.remove("nav-locked");
            });
        });
    }


    // ============================================================
    // NAVBAR SCROLL STATE
    // ============================================================

    function initNavbarScroll() {

        const nav = document.querySelector("[data-navbar]");
        if (!nav) return;

        const onScroll = () => {
            nav.classList.toggle("is-scrolled", window.scrollY > 40);
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
    }


    // ============================================================
    // SCROLL REVEAL
    // ============================================================

    function initReveal() {

        const items = document.querySelectorAll("[data-reveal]");
        if (!items.length) return;

        if (prefersReducedMotion) {
            items.forEach(el => el.classList.add("is-visible"));
            return;
        }

        const io = new IntersectionObserver((entries) => {

            entries.forEach(entry => {

                if (!entry.isIntersecting) return;

                const delay = Number(entry.target.dataset.revealDelay || 0);

                setTimeout(() => entry.target.classList.add("is-visible"), delay);

                io.unobserve(entry.target);
            });

        }, { threshold: 0.14, rootMargin: "0px 0px -60px 0px" });

        items.forEach(el => io.observe(el));
    }


    // ============================================================
    // 3D POINTER TILT
    // ============================================================

    function initTilt() {

        if (prefersReducedMotion) return;

        document.querySelectorAll("[data-tilt]").forEach(el => {

            const strength = parseFloat(el.dataset.tiltStrength || "8");
            let raf = null;

            el.addEventListener("pointermove", (e) => {

                if (e.pointerType === "touch") return;

                const rect = el.getBoundingClientRect();
                const px = (e.clientX - rect.left) / rect.width - 0.5;
                const py = (e.clientY - rect.top) / rect.height - 0.5;

                if (raf) cancelAnimationFrame(raf);

                raf = requestAnimationFrame(() => {
                    el.style.transform =
                        `perspective(900px) rotateX(${(-py * strength).toFixed(2)}deg) rotateY(${(px * strength).toFixed(2)}deg) translateZ(0)`;
                });
            });

            el.addEventListener("pointerleave", () => {
                if (raf) cancelAnimationFrame(raf);
                el.style.transform = "";
            });
        });
    }


    // ============================================================
    // ANIMATED COUNTERS
    // ============================================================

    function initCounters() {

        const items = document.querySelectorAll("[data-counter]");
        if (!items.length) return;

        function animate(el) {

            const target = parseFloat(el.dataset.counter);
            const suffix = el.dataset.counterSuffix || "";

            if (prefersReducedMotion || isNaN(target)) {
                el.textContent = target + suffix;
                return;
            }

            const duration = 1500;
            const start = performance.now();

            function tick(now) {

                const p = Math.min(1, (now - start) / duration);
                const eased = 1 - Math.pow(1 - p, 3);

                el.textContent = Math.round(target * eased) + suffix;

                if (p < 1) requestAnimationFrame(tick);
            }

            requestAnimationFrame(tick);
        }

        const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animate(entry.target);
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.6 });

        items.forEach(el => io.observe(el));
    }


    // ============================================================
    // TOASTS
    // ============================================================

    const ICONS = {

        success: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',

        error: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>',

        info: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };

    function ensureToastHost() {

        let host = document.querySelector(".toast-host");

        if (!host) {
            host = document.createElement("div");
            host.className = "toast-host";
            host.setAttribute("aria-live", "polite");
            document.body.appendChild(host);
        }

        return host;
    }

    function toast(message, type, duration) {

        type = type || "info";
        duration = duration === undefined ? 4200 : duration;

        const host = ensureToastHost();

        const el = document.createElement("div");
        el.className = "toast toast-" + type;

        el.innerHTML =
            '<span class="toast-icon">' + (ICONS[type] || ICONS.info) + '</span>' +
            '<span class="toast-msg"></span>' +
            '<button type="button" class="toast-close" aria-label="Dismiss">&times;</button>';

        el.querySelector(".toast-msg").textContent = message;

        host.appendChild(el);

        requestAnimationFrame(() => el.classList.add("is-in"));

        function remove() {
            el.classList.remove("is-in");
            setTimeout(() => el.remove(), 350);
        }

        el.querySelector(".toast-close").addEventListener("click", remove);

        if (duration) setTimeout(remove, duration);

        return el;
    }


    // ============================================================
    // CONFIRM DIALOG (replaces window.confirm)
    // ============================================================

    function confirmDialog(options) {

        options = options || {};

        const title = options.title || "Are you sure?";
        const message = options.message || "";
        const confirmLabel = options.confirmLabel || "Confirm";
        const cancelLabel = options.cancelLabel || "Cancel";
        const danger = !!options.danger;

        return new Promise((resolve) => {

            const overlay = document.createElement("div");
            overlay.className = "modal-overlay";

            overlay.innerHTML =
                '<div class="modal-box" role="alertdialog" aria-modal="true">' +
                    '<h3></h3>' +
                    '<p></p>' +
                    '<div class="modal-actions">' +
                        '<button type="button" class="btn btn-ghost" data-act="cancel"></button>' +
                        '<button type="button" class="btn ' + (danger ? "btn-danger" : "btn-primary") + '" data-act="confirm"></button>' +
                    '</div>' +
                '</div>';

            overlay.querySelector("h3").textContent = title;
            overlay.querySelector("p").textContent = message;
            overlay.querySelector('[data-act="cancel"]').textContent = cancelLabel;
            overlay.querySelector('[data-act="confirm"]').textContent = confirmLabel;

            document.body.appendChild(overlay);
            document.body.classList.add("nav-locked");

            requestAnimationFrame(() => overlay.classList.add("is-in"));

            function close(result) {
                overlay.classList.remove("is-in");
                document.body.classList.remove("nav-locked");
                setTimeout(() => overlay.remove(), 250);
                resolve(result);
            }

            overlay.addEventListener("click", (e) => {

                if (e.target === overlay) {
                    close(false);
                    return;
                }

                const actEl = e.target.closest("[data-act]");
                if (actEl) close(actEl.dataset.act === "confirm");
            });

            document.addEventListener("keydown", function onKey(e) {
                if (e.key === "Escape") {
                    close(false);
                    document.removeEventListener("keydown", onKey);
                }
            });
        });
    }


    // ============================================================
    // IMAGE FALLBACK
    // ============================================================

    function initImageFallback() {

        document.querySelectorAll("img[data-photo]").forEach(img => {

            img.addEventListener("error", () => {

                const wrap = img.closest("[data-photo-wrap]");

                if (wrap) wrap.classList.add("is-fallback");

                img.style.display = "none";

            }, { once: true });
        });
    }


    // ============================================================
    // HERO VISUAL — lightweight 2D "network" canvas
    // (nodes = complaints / departments, links = routing —
    //  used as the universal renderer, and as the fallback
    //  if the optional WebGL layer below can't run)
    // ============================================================

    function startNetwork2D(canvas) {

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let w, h, dpr, nodes = [], raf, visible = true;

        function resize() {

            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = canvas.clientWidth;
            h = canvas.clientHeight;

            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const count = Math.round((w * h) / 24000);

            nodes = Array.from({ length: Math.max(16, Math.min(60, count)) }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.22,
                vy: (Math.random() - 0.5) * 0.22,
                r: Math.random() * 1.6 + 0.9
            }));
        }

        function frame() {

            if (!visible) { raf = requestAnimationFrame(frame); return; }

            ctx.clearRect(0, 0, w, h);

            nodes.forEach(n => {
                n.x += n.vx; n.y += n.vy;
                if (n.x < 0 || n.x > w) n.vx *= -1;
                if (n.y < 0 || n.y > h) n.vy *= -1;
            });

            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {

                    const a = nodes[i], b = nodes[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const max = 140;

                    if (dist < max) {
                        ctx.strokeStyle = "rgba(196,58,70," + ((1 - dist / max) * 0.4).toFixed(3) + ")";
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }

            nodes.forEach(n => {
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r * 1.8, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(201,161,90,.9)";
                ctx.fill();
            });

            raf = requestAnimationFrame(frame);
        }

        resize();
        frame();

        window.addEventListener("resize", resize);
        document.addEventListener("visibilitychange", () => { visible = !document.hidden; });
    }


    // ============================================================
    // HERO VISUAL — optional real WebGL layer (Three.js)
    // Falls back to startNetwork2D on any failure.
    // ============================================================

    function supportsWebGL() {
        try {
            const c = document.createElement("canvas");
            return !!(window.WebGLRenderingContext &&
                (c.getContext("webgl") || c.getContext("experimental-webgl")));
        } catch (e) {
            return false;
        }
    }

    function startNetwork3D(canvas) {

        try {

            const THREE = window.THREE;
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 100);
            camera.position.z = 22;

            const COUNT = 85;
            const positions = new Float32Array(COUNT * 3);
            const nodes = [];

            for (let i = 0; i < COUNT; i++) {
                const x = (Math.random() - 0.5) * 30;
                const y = (Math.random() - 0.5) * 15;
                const z = (Math.random() - 0.5) * 13;
                positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
                nodes.push({
                    x: x, y: y, z: z,
                    vx: (Math.random() - 0.5) * 0.012,
                    vy: (Math.random() - 0.5) * 0.012,
                    vz: (Math.random() - 0.5) * 0.012
                });
            }

            const ptsGeo = new THREE.BufferGeometry();
            ptsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            const ptsMat = new THREE.PointsMaterial({ color: 0xC9A15A, size: 0.3, transparent: true, opacity: 0.95 });
            const points = new THREE.Points(ptsGeo, ptsMat);
            scene.add(points);

            const lineGeo = new THREE.BufferGeometry();
            const lineMat = new THREE.LineBasicMaterial({ color: 0xC43A46, transparent: true, opacity: 0.28 });
            const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
            scene.add(lineMesh);

            function updateLines() {
                const verts = [];
                const maxD = 7.5;
                for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                        const a = nodes[i], b = nodes[j];
                        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
                        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < maxD) {
                            verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
                        }
                    }
                }
                lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
            }

            let mouseX = 0, mouseY = 0;

            window.addEventListener("pointermove", (e) => {
                mouseX = e.clientX / window.innerWidth - 0.5;
                mouseY = e.clientY / window.innerHeight - 0.5;
            });

            function resize() {
                const w = canvas.clientWidth || 1;
                const h = canvas.clientHeight || 1;
                renderer.setSize(w, h, false);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            }

            resize();
            window.addEventListener("resize", resize);

            let frameCount = 0, raf;

            function animate() {

                frameCount++;

                nodes.forEach((n, i) => {
                    n.x += n.vx; n.y += n.vy; n.z += n.vz;
                    if (Math.abs(n.x) > 15) n.vx *= -1;
                    if (Math.abs(n.y) > 7.5) n.vy *= -1;
                    if (Math.abs(n.z) > 6.5) n.vz *= -1;
                    positions[i * 3] = n.x; positions[i * 3 + 1] = n.y; positions[i * 3 + 2] = n.z;
                });

                ptsGeo.attributes.position.needsUpdate = true;

                if (frameCount % 3 === 0) updateLines();

                points.rotation.y += 0.0007;
                lineMesh.rotation.y += 0.0007;

                camera.position.x += (mouseX * 3 - camera.position.x) * 0.02;
                camera.position.y += (-mouseY * 2 - camera.position.y) * 0.02;
                camera.lookAt(0, 0, 0);

                renderer.render(scene, camera);
                raf = requestAnimationFrame(animate);
            }

            document.addEventListener("visibilitychange", () => {
                if (document.hidden) cancelAnimationFrame(raf);
                else animate();
            });

            animate();
            return true;

        } catch (err) {
            console.warn("3D hero visual unavailable, using 2D fallback:", err);
            return false;
        }
    }

    // Public entry point used by index.html / login.html
    function initHeroVisual(canvas, opts) {

        if (!canvas) return;

        opts = opts || {};

        if (prefersReducedMotion) {
            canvas.style.display = "none";
            return;
        }

        const wantsWebGL = !opts.force2D && window.THREE && supportsWebGL();

        if (wantsWebGL) {

            const ok = startNetwork3D(canvas);

            if (!ok) {
                // WebGL context creation can only be attempted once per
                // canvas element — swap in a fresh node for the 2D fallback.
                const fresh = canvas.cloneNode();
                canvas.replaceWith(fresh);
                startNetwork2D(fresh);
            }

        } else {
            startNetwork2D(canvas);
        }
    }


    // ============================================================
    // PUBLIC API
    // ============================================================

    window.CampusCare = window.CampusCare || {};
    window.CampusCare.toast = toast;
    window.CampusCare.confirmDialog = confirmDialog;
    window.CampusCare.initHeroVisual = initHeroVisual;
    window.CampusCare.refreshTilt = initTilt;
    window.CampusCare.refreshReveal = initReveal;


    // ============================================================
    // BOOT
    // ============================================================

    document.addEventListener("DOMContentLoaded", () => {
        initMobileNav();
        initNavbarScroll();
        initReveal();
        initTilt();
        initCounters();
        initImageFallback();
    });

})();
