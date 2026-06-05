// ==================== CONFIGURATION ====================
const API_URL = 'https://hermana-acad.onrender.com/api';
let token = localStorage.getItem('token');
let currentUser = null;
let currentRating = 5;

// ==================== HELPER FUNCTIONS ====================
async function apiCall(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
        const res = await fetch(API_URL + endpoint, { ...options, headers });
        if (res.status === 401) logout();
        return res;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// ==================== FEEDBACK ====================
async function submitFeedback() {
    const name = document.getElementById('fbName')?.value;
    const email = document.getElementById('fbEmail')?.value;
    const role = document.getElementById('fbRole')?.value;
    const rating = currentRating;
    const message = document.getElementById('fbMessage')?.value;
    
    if (!name || !message) {
        alert('Please fill name and message!');
        return;
    }
    
    try {
        const res = await fetch(API_URL + '/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, role, rating, message })
        });
        if (res.ok) {
            alert('✅ Thank you for your feedback!');
            closeModal('feedbackModal');
        } else {
            alert('Error submitting feedback');
        }
    } catch (err) {
        alert('Error submitting feedback');
    }
}

// ==================== MODALS ====================
function loadModals() {
    if (document.getElementById('purposeModal')) return;
    
    const modalsHTML = `
        <div id="purposeModal" class="modal">
            <div class="modal-content">
                <div class="modal-header"><h2>🎯 My Purpose</h2><button class="close-modal" onclick="closeModal('purposeModal')">&times;</button></div>
                <div class="modal-body">
                    <p><strong>My name is Muhammad Ilyas, and I created Hermana Academy with a clear vision.</strong></p><br>
                    <p>As a developer passionate about education technology, I created this complete school management system to digitize Ethiopian education.</p><br>
                    <p><strong>My purpose is to:</strong></p>
                    <ul><li>Digitize Ethiopian education from Nursery to Grade 12</li><li>Provide secure, timed exams with verification</li><li>Enable instant student ID card generation</li><li>Streamline fee payments with receipt upload and verification</li><li>Create transparent financial management for schools</li><li>Empower teachers with digital application workflows</li><li>Give boards and directors real-time insights</li></ul>
                    <br><p>This system is my contribution to Ethiopia's digital future in education. 🇪🇹</p>
                </div>
            </div>
        </div>
        <div id="feedbackModal" class="modal">
            <div class="modal-content">
                <div class="modal-header"><h2>💬 Share Your Feedback</h2><button class="close-modal" onclick="closeModal('feedbackModal')">&times;</button></div>
                <div class="modal-body">
                    <form id="feedbackFormModal">
                        <div class="form-group"><label>Your Name *</label><input type="text" id="fbName" required></div>
                        <div class="form-group"><label>Email</label><input type="email" id="fbEmail"></div>
                        <div class="form-group"><label>Role</label><select id="fbRole"><option>Student</option><option>Parent</option><option>Teacher</option><option>Administrator</option></select></div>
                        <div class="form-group"><label>Rating</label><div class="star-rating" id="starRating"><span class="star" data-rating="1">★</span><span class="star" data-rating="2">★</span><span class="star" data-rating="3">★</span><span class="star" data-rating="4">★</span><span class="star" data-rating="5">★</span></div><input type="hidden" id="fbRating" value="5"></div>
                        <div class="form-group"><label>Your Message *</label><textarea rows="4" id="fbMessage" required></textarea></div>
                        <button type="button" onclick="submitFeedback()">Submit Feedback</button>
                    </form>
                </div>
            </div>
        </div>
        <div id="privacyModal" class="modal">
            <div class="modal-content">
                <div class="modal-header"><h2>🔒 Privacy Policy</h2><button class="close-modal" onclick="closeModal('privacyModal')">&times;</button></div>
                <div class="modal-body"><p>Your data is secure. We collect only necessary information for school management. We do not share your data with third parties.</p></div>
            </div>
        </div>
        <div id="contactModal" class="modal">
            <div class="modal-content">
                <div class="modal-header"><h2>📞 Contact Us</h2><button class="close-modal" onclick="closeModal('contactModal')">&times;</button></div>
                <div class="modal-body"><p>Email: info@hermanaacademy.edu.et<br>Phone: +251-XXX-XXXX<br>Addis Ababa, Ethiopia</p></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalsHTML);
    
    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', function() {
            currentRating = parseInt(this.dataset.rating);
            document.querySelectorAll('.star').forEach(s => {
                if (parseInt(s.dataset.rating) <= currentRating) s.classList.add('active');
                else s.classList.remove('active');
            });
            document.getElementById('fbRating').value = currentRating;
        });
    });
}

// ==================== FOOTER ====================
function loadFooter() {
    const footerHTML = `
        <div class="footer-links">
            <a onclick="openModal('purposeModal')">🎯 My Purpose</a>
            <a onclick="openModal('feedbackModal')">💬 Feedback</a>
            <a onclick="openModal('privacyModal')">🔒 Privacy Policy</a>
            <a onclick="openModal('contactModal')">📞 Contact Us</a>
        </div>
        <div class="creator-credit">
            Created with <span>❤️</span> by <span>Muhammad Ilyas</span> | Hermana Academy Management System
        </div>
    `;
    const container = document.querySelector('.container');
    if (container && !document.querySelector('.creator-credit')) {
        container.insertAdjacentHTML('beforeend', footerHTML);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadModals();
    loadFooter();
});
