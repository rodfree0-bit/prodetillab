// =============================================
// MY CARWASH APP — Landing Page Script
// =============================================

// ---- Navbar scroll effect ----
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 60) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// ---- Mobile menu ----
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.getElementById('navLinks');

if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = mobileMenuBtn.querySelector('.material-symbols-outlined');
        icon.textContent = navLinks.classList.contains('active') ? 'close' : 'menu';
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const icon = mobileMenuBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = 'menu';
        });
    });
}

// ---- Smooth scroll ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;

        // Handle contact link specifically to open chat
        if (href === '#contact') {
            e.preventDefault();
            if (chatToggle && chatWindow) {
                if (!chatWindow.classList.contains('active')) {
                    chatToggle.click();
                }
            }
            return;
        }

        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Handle the "Download" nav buttons specifically
document.querySelectorAll('a[href="#download"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const downloadSection = document.querySelector('.hero-download-links') || document.querySelector('.cta-section');
        if (downloadSection) {
            downloadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
});

// Update the placeholder links to also scroll instead of direct open for "Book via App"
const bookButtons = document.querySelectorAll('.btn-service');
bookButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (btn.getAttribute('href') === '#') {
            e.preventDefault();
            const downloadSection = document.querySelector('.hero-download-links') || document.querySelector('.cta-section');
            if (downloadSection) {
                downloadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
});

// ---- Scroll-triggered card animations ----
const animatedEls = document.querySelectorAll(
    '.feature-card, .service-card, .step-card, .tip-card, .vehicle-type-card, .hero-stats, .section-header, .before-after-slider, .quote-wrapper, .price-calc-container, .local-grid > div, .local-edge-grid'
);

const observer = new IntersectionObserver((entries) => {
    // Filter out entries that are intersecting to stagger them
    const intersecting = entries.filter(e => e.isIntersecting);
    
    intersecting.forEach((entry, index) => {
        const el = entry.target;
        
        // Stagger elements entering the viewport together (80ms interval)
        const delay = index * 80;
        
        setTimeout(() => {
            el.classList.add('visible');
            
            // Animation for stats
            if (el.classList.contains('hero-stats')) {
                const counters = el.querySelectorAll('.count-up');
                counters.forEach(counter => animateCounter(counter));
            }
        }, delay);
        
        observer.unobserve(el);
    });
}, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

animatedEls.forEach(el => observer.observe(el));

function animateCounter(el) {
    const text = el.innerText;
    const target = parseInt(text.replace(/\D/g, ''));
    if (isNaN(target)) return;
    
    const suffix = text.replace(/[0-9]/g, '');
    let current = 0;
    const duration = 2000;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out quad
        const easeProgress = progress * (2 - progress);
        current = Math.floor(easeProgress * target);
        
        el.innerText = current + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.innerText = target + suffix;
        }
    }
    
    requestAnimationFrame(update);
}

// ---- Luxe Glow Tracing Interaction ----
const luxeCards = document.querySelectorAll('.service-card, .addon-card');
luxeCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

// ---- Hero floating particles ----
(function createParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;
    const count = 25;
    for (let i = 0; i < count; i++) {
        const dot = document.createElement('span');
        dot.className = 'particle';
        const size = Math.random() * 4 + 2;
        dot.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${Math.random() > 0.5 ? 'rgba(59,130,246,' : 'rgba(139,92,246,'}${(Math.random() * 0.3 + 0.1)});
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: float ${Math.random() * 6 + 5}s ease-in-out ${Math.random() * 4}s infinite;
            pointer-events: none;
        `;
        container.appendChild(dot);
    }
})();

// ---- App Store / Play Store placeholder links ----
const storeButtons = [
    'appStoreBtnHero', 'playStoreBtnHero',
    'appStoreBtnFooter', 'playStoreBtnFooter',
    'appStoreBtnCta', 'playStoreBtnCta',
    'appStoreBtnService1', 'appStoreBtnService2', 'appStoreBtnService3'
];

storeButtons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Replace these with your real App Store / Play Store URLs
            const isApple = id.toLowerCase().includes('appstore') || id.toLowerCase().includes('ios');
            const link = isApple
                ? 'https://apps.apple.com/us/app/my-carwash-on-demand-detail/id6759268463'
                : 'https://play.google.com/store/apps/details?id=com.rodrigo.mycarwash.app';
            window.open(link, '_blank');
        });
    }
});

// =============================================
// QUOTE FORM HANDLING — Consolidated Firebase submission
// =============================================

// Helper for showing form messages
function setFormState(formId, loading, success = false, errorMsg = '') {
    const form = document.getElementById(formId);
    if (!form) return;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('span:first-child');
    const loadingEl = submitBtn.querySelector('.animate-spin')?.parentElement || submitBtn.querySelector('span:last-child');
    const successEl = document.getElementById(formId.replace('Form', 'Success')) || document.getElementById('quoteSuccess');
    
    if (submitBtn) submitBtn.disabled = loading;
    if (btnText) btnText.style.display = loading ? 'none' : 'inline-flex';
    if (loadingEl) loadingEl.style.display = loading ? 'flex' : 'none';
    
    if (success && successEl) {
        form.style.display = 'none';
        successEl.style.display = 'block';
    }
}

async function handleQuoteSubmission(category, data, formId) {
    setFormState(formId, true);
    try {
        const { collection, addDoc, serverTimestamp } = window.firestoreFunctions;
        const db = window.db;

        await addDoc(collection(db, 'quotes'), {
            ...data,
            category,
            status: 'new',
            createdAt: serverTimestamp()
        });

        setFormState(formId, false, true);
    } catch (err) {
        console.error('Quote submission error:', err);
        alert('Something went wrong. Please try again or call us.');
        setFormState(formId, false);
    }
}

// Truck/Fleet Form
const truckQuoteForm = document.getElementById('truckQuoteForm');
if (truckQuoteForm) {
    truckQuoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            fullName: document.getElementById('qName').value.trim(),
            phone: document.getElementById('qPhone').value.trim(),
            company: document.getElementById('qCompany').value.trim(),
            email: document.getElementById('qEmail').value.trim(),
            vehicleCount: document.getElementById('qVehicleCount').value,
            vehicleType: document.getElementById('qVehicleType').value,
            vehicleModel: document.getElementById('qVehicleModel').value.trim(),
            service: document.getElementById('qService').value,
            address: document.getElementById('qLocation').value.trim(),
            message: document.getElementById('qMessage').value.trim(),
            source: 'landing-fleet'
        };
        handleQuoteSubmission('fleet', data, 'truckQuoteForm');
    });
}

// RV Form
const rvQuoteForm = document.getElementById('rvQuoteForm');
if (rvQuoteForm) {
    rvQuoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            fullName: document.getElementById('rvName').value.trim(),
            phone: document.getElementById('rvPhone').value.trim(),
            email: document.getElementById('rvEmail').value.trim(),
            address: document.getElementById('rvLocation').value.trim(),
            rvModel: document.getElementById('rvModel').value.trim(),
            rvLength: document.getElementById('rvLength').value,
            service: document.getElementById('rvService').value,
            message: document.getElementById('rvMessage').value.trim(),
            source: 'landing-rv'
        };
        handleQuoteSubmission('rv', data, 'rvQuoteForm');
    });
}

function showFormError(msg) {
    let errEl = document.getElementById('formError');
    if (!errEl) {
        errEl = document.createElement('p');
        errEl.id = 'formError';
        errEl.style.cssText = 'color:#f87171;font-size:0.85rem;margin-top:0.75rem;text-align:center;';
        if (truckQuoteForm) truckQuoteForm.appendChild(errEl);
    }
    if (errEl) {
        errEl.textContent = msg;
        setTimeout(() => { if (errEl) errEl.textContent = ''; }, 5000);
    }
}

// =============================================
// SUPPORT CHAT WIDGET — Firebase real-time
// =============================================
const chatToggle = document.getElementById('chatToggle');
const chatWindow = document.getElementById('chatWindow');
const chatClose = document.getElementById('chatClose');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const startChatBtn = document.getElementById('startChatBtn');
const chatInputArea = document.querySelector('.chat-input-container');
const chatNameInput = document.getElementById('chatName');
const chatContactInput = document.getElementById('chatContact');
const chatLocationInput = document.getElementById('chatLocation');

let unsubscribeChat = null;

if (chatToggle) {
    chatToggle.addEventListener('click', () => {
        chatWindow.classList.toggle('active');
        if (chatWindow.classList.contains('active')) checkChatState();
    });
}

if (chatClose) {
    chatClose.addEventListener('click', () => chatWindow.classList.remove('active'));
}

function checkChatState() {
    const savedUser = localStorage.getItem('chatUser');
    if (savedUser) {
        showChatInterface();
    } else {
        showFormInterface();
    }
}

function showFormInterface() {
    if (chatForm) chatForm.style.display = 'flex';
    if (chatMessages) chatMessages.style.display = 'none';
    if (chatInputArea) chatInputArea.style.display = 'none';
}

function addMessageToUI(text, type, id) {
    if (id && document.getElementById(`msg-${id}`)) return;
    const msgDiv = document.createElement('div');
    if (id) msgDiv.id = `msg-${id}`;
    msgDiv.className = `chat-message ${type}`;
    msgDiv.innerHTML = `<p>${text}</p>`;
    if (chatMessages) {
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function subscribeToMessages(ticketId) {
    if (unsubscribeChat) unsubscribeChat();
    const { collection, query, orderBy, onSnapshot } = window.firestoreFunctions;
    const db = window.db;
    const q = query(collection(db, 'supportTickets', ticketId, 'messages'), orderBy('timestamp', 'asc'));
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const role = data.senderRole;
                addMessageToUI(data.message, (role === 'admin' || role === 'system') ? 'bot' : 'user', change.doc.id);
            }
        });
    }, (err) => console.error('Chat listener error:', err));
}

function showChatInterface() {
    if (chatForm) chatForm.style.display = 'none';
    if (chatMessages) {
        chatMessages.style.display = 'flex';
        chatMessages.style.flexDirection = 'column';
        chatMessages.innerHTML = '';
        addMessageToUI('Welcome! How can we help with your car detail today?', 'bot', null);
    }
    if (chatInputArea) chatInputArea.style.display = 'flex';
    const ticketId = localStorage.getItem('supportTicketId');
    if (ticketId) subscribeToMessages(ticketId);
    setTimeout(() => chatInput && chatInput.focus(), 100);
}

if (startChatBtn) {
    startChatBtn.addEventListener('click', () => {
        const name = chatNameInput.value.trim();
        const contact = chatContactInput.value.trim();
        const location = chatLocationInput ? chatLocationInput.value.trim() : '';
        if (!name || !contact) {
            alert('Please enter your name and phone/email.');
            return;
        }
        localStorage.setItem('chatUser', JSON.stringify({ name, contact, location }));
        showChatInterface();
    });
}

async function sendChatMessage() {
    if (!chatInput) return;
    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.disabled = true;
    if (chatSend) chatSend.disabled = true;
    chatInput.value = '';

    try {
        const { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } = window.firestoreFunctions;
        const db = window.db;
        const userData = JSON.parse(localStorage.getItem('chatUser') || '{"name":"Visitor","contact":"Unknown","location":""}');
        let ticketId = localStorage.getItem('supportTicketId');

        if (ticketId) {
            try {
                const snap = await getDoc(doc(db, 'supportTickets', ticketId));
                if (!snap.exists() || snap.data().status !== 'open') {
                    ticketId = null;
                    localStorage.removeItem('supportTicketId');
                }
            } catch (err) { ticketId = null; localStorage.removeItem('supportTicketId'); }
        }

        if (!ticketId) {
            const guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            const docRef = await addDoc(collection(db, 'supportTickets'), {
                clientId: guestId, userRole: 'guest',
                userName: userData.name, userEmail: userData.contact,
                status: 'open',
                source: `Landing Page - ${userData.location || 'No Location'} (${userData.contact})`,
                createdAt: serverTimestamp(), lastMessageAt: serverTimestamp(),
                unreadByClient: 0, unreadByAdmin: 1
            });
            ticketId = docRef.id;
            localStorage.setItem('supportTicketId', ticketId);
            localStorage.setItem('guest_support_id', guestId);
            subscribeToMessages(ticketId);
        }

        let guestId = localStorage.getItem('guest_support_id');
        if (!guestId) {
            const snap = await getDoc(doc(db, 'supportTickets', ticketId));
            guestId = snap.exists() ? snap.data().clientId : 'guest_unknown';
            localStorage.setItem('guest_support_id', guestId);
        }

        await addDoc(collection(db, 'supportTickets', ticketId, 'messages'), {
            senderId: guestId, senderName: userData.name,
            senderRole: 'client', message,
            timestamp: serverTimestamp(), read: false
        });

        await updateDoc(doc(db, 'supportTickets', ticketId), {
            lastMessageAt: serverTimestamp(), unreadByAdmin: 1, status: 'open'
        });

    } catch (err) {
        console.error('Chat send error:', err);
        addMessageToUI('Error sending message. Please try again.', 'bot', null);
    } finally {
        chatInput.disabled = false;
        if (chatSend) chatSend.disabled = false;
        chatInput.focus();
    }
}

if (chatSend) chatSend.addEventListener('click', sendChatMessage);
if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });

// =============================================
// SEO / EXPERT TIPS — Firebase loader
// =============================================
async function loadExpertTips() {
    const tipsGrid = document.getElementById('seoTipsGrid');
    if (!tipsGrid || tipsGrid.getAttribute('data-localized') === 'true') return;

    if (!window.firestoreFunctions) {
        console.log('Firebase functions not found yet, retrying...');
        setTimeout(loadExpertTips, 500);
        return;
    }

    const { doc, getDoc } = window.firestoreFunctions;
    const db = window.db;

    if (!doc || !getDoc) {
        console.error('Core Firestore doc/getDoc functions missing in window.firestoreFunctions');
        return;
    }

    try {
        const docRef = doc(db, 'seo_config', 'daily_tip_cache');
        const docSnap = await getDoc(docRef);

        tipsGrid.innerHTML = '';
        if (docSnap.exists()) {
            renderTip(docSnap.data(), tipsGrid);
        } else {
            const demoTip = {
                title: "Premium Car Care Daily",
                content: "Consistent professional maintenance is the secret to vehicle longevity. Our AI-optimized detailing ensures your car stays protected in the Southern California sun.",
            };
            renderTip(demoTip, tipsGrid);
        }
    } catch (err) {
        console.error('Tips load error:', err);
    }
}

function renderTip(data, container) {
    const sentences = data.content.split('. ');
    let title = data.title || 'Expert Insight';
    let description = data.content;

    if (!data.title && sentences.length > 1) {
        title = sentences[0] + (sentences[0].match(/[?!.]$/) ? '' : '.');
        description = sentences.slice(1).join('. ');
    }

    container.insertAdjacentHTML('beforeend', `
        <div class="tip-card visible">
            <div class="tip-tag">PREMIUM CARE</div>
            <h3>${title}</h3>
            <p>${description}</p>
        </div>
    `);
}

// Wait for Firebase then load tips
if (window.firebaseReady) {
    loadExpertTips();
} else {
    window.addEventListener('firebaseReady', loadExpertTips);
}
// =============================================
// COOKIE BANNER — Consent management
// =============================================
const cookieBanner = document.getElementById('cookieBanner');
const acceptCookies = document.getElementById('acceptCookies');

if (cookieBanner && acceptCookies) {
    // Check if user already accepted
    if (!localStorage.getItem('cookiesAccepted')) {
        // Delay appearance slightly for better UX
        setTimeout(() => {
            cookieBanner.classList.add('active');
        }, 2000);
    }

    acceptCookies.addEventListener('click', () => {
        localStorage.setItem('cookiesAccepted', 'true');
        cookieBanner.classList.remove('active');
    });
}

// =============================================
// PROMO ANNOUNCEMENT BAR — Top e-commerce style
// =============================================
const promoBar = document.getElementById('promoBar');

if (promoBar) {
    setTimeout(() => {
        promoBar.classList.add('active');
    }, 400);
}

function copyPromoCode() {
    navigator.clipboard.writeText('WELCOME20').then(() => {
        const el = document.getElementById('promoCopied');
        if (!el) return;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 2200);
    }).catch(() => {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = 'WELCOME20';
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        const el = document.getElementById('promoCopied');
        if (el) { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); }
    });
    sessionStorage.setItem('promoDismissed', 'true');
}

// ---- Services Carousel REFINED ----
const servicesGrid = document.getElementById('servicesGrid');
const servicesPrev = document.getElementById('servicesPrev');
const servicesNext = document.getElementById('servicesNext');
const servicesDots = document.getElementById('servicesDots');

if (servicesGrid && servicesPrev && servicesNext) {
    const cards = Array.from(servicesGrid.querySelectorAll('.service-card'));
    
    // Create Dots dynamically
    if (servicesDots && servicesDots.innerHTML === '') {
        cards.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => {
                const cardWidth = cards[0].offsetWidth + 24; // 24 = 1.5rem gap
                servicesGrid.scrollTo({ left: i * cardWidth, behavior: 'smooth' });
            });
            servicesDots.appendChild(dot);
        });
    }

    const updateCarousel = () => {
        const scrollLeft = servicesGrid.scrollLeft;
        const cardWidth = cards[0].offsetWidth + 24;
        const activeIndex = Math.round(scrollLeft / cardWidth);
        
        // Update Dots
        if (servicesDots) {
            const dots = servicesDots.querySelectorAll('.dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === activeIndex);
            });
        }

        // Card Focus Effect (Subtle scale on mobile)
        cards.forEach((card, i) => {
            if (window.innerWidth <= 768) {
                const distance = Math.abs(i - activeIndex);
                card.style.opacity = distance === 0 ? '1' : '0.5';
                card.style.transform = distance === 0 ? 'scale(1)' : 'scale(0.94)';
            } else {
                card.style.opacity = '1';
                card.style.transform = 'scale(1)';
            }
        });

        // Button Visibility
        const isAtStart = scrollLeft <= 10;
        const isAtEnd = scrollLeft + servicesGrid.offsetWidth >= servicesGrid.scrollWidth - 10;
        servicesPrev.style.opacity = isAtStart ? '0' : '1';
        servicesPrev.style.pointerEvents = isAtStart ? 'none' : 'auto';
        servicesNext.style.opacity = isAtEnd ? '0' : '1';
        servicesNext.style.pointerEvents = isAtEnd ? 'none' : 'auto';
    };

    servicesPrev.addEventListener('click', () => {
        const cardWidth = cards[0].offsetWidth + 24;
        servicesGrid.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    });

    servicesNext.addEventListener('click', () => {
        const cardWidth = cards[0].offsetWidth + 24;
        servicesGrid.scrollBy({ left: cardWidth, behavior: 'smooth' });
    });

    servicesGrid.addEventListener('scroll', updateCarousel);
    window.addEventListener('resize', updateCarousel);
    
    // Initial check
    setTimeout(updateCarousel, 500);
}

// =============================================
// INTERACTIVE COMPACT GALLERY CONTROL
// =============================================
(function initCompactGallery() {
    const galleryMainImage = document.getElementById('galleryMainImage');
    const galleryCaption = document.getElementById('galleryCaption');
    const galleryPrev = document.getElementById('galleryPrev');
    const galleryNext = document.getElementById('galleryNext');
    const thumbBtns = document.querySelectorAll('#galleryThumbnails .thumb-btn');

    if (galleryMainImage && thumbBtns.length > 0) {
        let currentIndex = 0;
        const images = Array.from(thumbBtns).map(btn => ({
            src: btn.getAttribute('data-img'),
            caption: btn.getAttribute('data-caption')
        }));

        const updateGallery = (index) => {
            currentIndex = (index + images.length) % images.length;
            
            // Fade transition
            galleryMainImage.style.opacity = '0';
            setTimeout(() => {
                galleryMainImage.src = images[currentIndex].src;
                galleryCaption.textContent = images[currentIndex].caption;
                galleryMainImage.style.opacity = '1';
            }, 150);

            // Update active state on thumbnails
            thumbBtns.forEach((btn, idx) => {
                btn.classList.toggle('active', idx === currentIndex);
            });
        };

        if (galleryPrev) {
            galleryPrev.addEventListener('click', () => updateGallery(currentIndex - 1));
        }
        if (galleryNext) {
            galleryNext.addEventListener('click', () => updateGallery(currentIndex + 1));
        }

        thumbBtns.forEach((btn, idx) => {
            btn.addEventListener('click', () => updateGallery(idx));
        });

        // Auto play every 5 seconds (pauses on hover)
        let autoplay = setInterval(() => updateGallery(currentIndex + 1), 5000);
        const stopAutoplay = () => clearInterval(autoplay);
        const startAutoplay = () => {
            clearInterval(autoplay);
            autoplay = setInterval(() => updateGallery(currentIndex + 1), 5000);
        };

        const widget = document.querySelector('.gallery-widget');
        if (widget) {
            widget.addEventListener('mouseenter', stopAutoplay);
            widget.addEventListener('mouseleave', startAutoplay);
        }
    }
})();

// =============================================
// INTERACTIVE BEFORE/AFTER SLIDER
// =============================================
(function() {
    const sliderRange = document.getElementById('sliderRange');
    const afterContainer = document.getElementById('afterContainer');
    const sliderDivider = document.getElementById('sliderDivider');
    const afterImg = afterContainer ? afterContainer.querySelector('.after-img') : null;

    if (sliderRange && afterContainer && sliderDivider) {
        const updateSlider = () => {
            const value = sliderRange.value;
            afterContainer.style.width = `${value}%`;
            sliderDivider.style.left = `${value}%`;
        };
        
        sliderRange.addEventListener('input', updateSlider);
        sliderRange.addEventListener('change', updateSlider);

        const adjustImageWidth = () => {
            const containerWidth = sliderRange.parentElement.clientWidth;
            if (afterImg) {
                afterImg.style.width = containerWidth + 'px';
            }
        };

        window.addEventListener('resize', adjustImageWidth);
        // Run immediately and after a short timeout to ensure container is rendered
        adjustImageWidth();
        setTimeout(adjustImageWidth, 100);
        setTimeout(adjustImageWidth, 500);
    }
})();

// =============================================
// DETAILING LAB PRICE ESTIMATOR (CALCULATOR)
// =============================================
(function() {
    const vehicleTabs = document.querySelectorAll('.vehicle-tab');
    const pkgOptions = document.querySelectorAll('.pkg-option');
    const addonChecks = document.querySelectorAll('.addon-check-item input');
    const receiptTotal = document.getElementById('receiptTotal');
    const receiptVehicleVal = document.getElementById('receiptVehicleVal');
    const receiptPackageVal = document.getElementById('receiptPackageVal');
    const receiptAddonsList = document.getElementById('receiptAddonsList');

    if (!receiptTotal) return; // Only run if element exists on page

    const prices = {
        sedan: { refresh: 50, interior: 200, showroom: 350 },
        suv: { refresh: 70, interior: 225, showroom: 400 },
        truck: { refresh: 80, interior: 255, showroom: 450 }
    };

    const addonPrices = {
        claybar: 60,
        ceramic: 150,
        engine: 50,
        headlight: 80,
        pethair: 50,
        extradirty: 50
    };

    const addonNames = {
        claybar: 'Clay Bar & Iron Decon',
        ceramic: '1-Year Ceramic Coating',
        engine: 'Engine Bay Restoration',
        headlight: 'Headlight Restoration',
        pethair: 'Pet Hair Removal',
        extradirty: 'Extra Dirty / Soil Detail'
    };

    let currentSize = 'sedan';
    let currentPkg = 'refresh';

    const calculateTotal = () => {
        let basePrice = prices[currentSize][currentPkg];
        let total = basePrice;
        
        // Update badge prices in package list based on vehicle size
        const refBadge = document.querySelector('[data-price-refresh]');
        const intBadge = document.querySelector('[data-price-interior]');
        const shoBadge = document.querySelector('[data-price-showroom]');
        
        if (refBadge) refBadge.textContent = `$${prices[currentSize]['refresh']}`;
        if (intBadge) intBadge.textContent = `$${prices[currentSize]['interior']}`;
        if (shoBadge) shoBadge.textContent = `$${prices[currentSize]['showroom']}`;
        
        if (receiptVehicleVal) {
            const sizeLabel = currentSize === 'sedan' ? 'Sedan / Coupe' : (currentSize === 'suv' ? 'SUV / Crossover' : 'Truck / Large SUV');
            receiptVehicleVal.textContent = sizeLabel;
        }
        
        if (receiptPackageVal) {
            const pkgLabel = currentPkg === 'refresh' ? 'Super Wash' : (currentPkg === 'interior' ? 'Deep Interior' : 'Showroom Full');
            receiptPackageVal.textContent = `${pkgLabel} ($${basePrice})`;
        }
        
        if (receiptAddonsList) {
            receiptAddonsList.innerHTML = '';
            let selectedAddons = 0;
            
            addonChecks.forEach(input => {
                const item = input.closest('.addon-check-item');
                const key = item.getAttribute('data-addon');
                if (input.checked) {
                    selectedAddons++;
                    total += addonPrices[key];
                    
                    const row = document.createElement('div');
                    row.className = 'receipt-row';
                    row.innerHTML = `
                        <span class="receipt-addon-label">+ ${addonNames[key]}</span>
                        <span class="receipt-addon-value">+$${addonPrices[key]}</span>
                    `;
                    receiptAddonsList.appendChild(row);
                }
            });
            
            if (selectedAddons === 0) {
                receiptAddonsList.innerHTML = '<div class="receipt-no-addons">No add-ons selected</div>';
            }
        }
        
        // Animated price counter
        const startVal = parseInt(receiptTotal.textContent) || 0;
        animatePrice(startVal, total);
    };

    const animatePrice = (start, end) => {
        if (start === end) {
            receiptTotal.textContent = end;
            return;
        }
        const duration = 300; // ms
        const startTime = performance.now();
        
        const update = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress); // Ease out exponential
            const current = Math.floor(start + (end - start) * ease);
            receiptTotal.textContent = current;
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                receiptTotal.textContent = end;
            }
        };
        requestAnimationFrame(update);
    };

    // Event Listeners
    vehicleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            vehicleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSize = tab.getAttribute('data-size');
            calculateTotal();
        });
    });

    pkgOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            pkgOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            currentPkg = opt.getAttribute('data-package');
            calculateTotal();
        });
    });

    addonChecks.forEach(check => {
        check.addEventListener('change', calculateTotal);
    });

    // Run once on load to init values
    calculateTotal();
})();

// =============================================
// CURSOR RADIAL MOUSE GLOW COORDINATES TRACKER
// =============================================
(function() {
    const cards = document.querySelectorAll('.service-card, .addon-card, .feature-card');
    cards.forEach(card => {
        card.style.setProperty('--mouse-x', `50%`);
        card.style.setProperty('--mouse-y', `50%`);
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
})();


