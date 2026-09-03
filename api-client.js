// ===============================================
// NITR CAMPUSCARE — SELF-HOSTED API CLIENT & BRIDGE
// ===============================================

(function () {
    const API_BASE = window.location.origin;
    const TOKEN_KEY = 'campuscare_auth_token';
    const USER_KEY = 'campuscare_auth_user';

    // ===========================================
    // NATIVE API METHODS
    // ===========================================
    const CampusCareAPI = {
        getToken() {
            return localStorage.getItem(TOKEN_KEY);
        },

        setSession(token, user) {
            if (token) localStorage.setItem(TOKEN_KEY, token);
            if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
        },

        clearSession() {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        },

        getUserSync() {
            try {
                const u = localStorage.getItem(USER_KEY);
                return u ? JSON.parse(u) : null;
            } catch (e) {
                return null;
            }
        },

        async request(endpoint, options = {}) {
            const token = this.getToken();
            const headers = { ...options.headers };

            if (token && !headers['Authorization']) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            if (!(options.body instanceof FormData) && !headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }

            const res = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                const err = new Error(data.error || data.message || `Request failed with status ${res.status}`);
                err.status = res.status;
                err.data = data;
                throw err;
            }

            return data;
        },

        // Auth
        auth: {
            async login(email, password) {
                const data = await CampusCareAPI.request('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                CampusCareAPI.setSession(data.token, data.user);
                return data;
            },

            async register(userData) {
                const data = await CampusCareAPI.request('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });
                if (data.token) {
                    CampusCareAPI.setSession(data.token, data.user);
                }
                return data;
            },

            async getUser() {
                const token = CampusCareAPI.getToken();
                if (!token) return { data: { user: null }, error: null };
                try {
                    const data = await CampusCareAPI.request('/api/auth/me');
                    CampusCareAPI.setSession(token, data.user);
                    return { data: { user: data.user }, error: null };
                } catch (err) {
                    CampusCareAPI.clearSession();
                    return { data: { user: null }, error: err };
                }
            },

            async logout() {
                CampusCareAPI.clearSession();
                return { error: null };
            },

            async forgotPassword(email) {
                return await CampusCareAPI.request('/api/auth/forgot-password', {
                    method: 'POST',
                    body: JSON.stringify({ email })
                });
            },

            async resetPassword(password, token, email) {
                return await CampusCareAPI.request('/api/auth/reset-password', {
                    method: 'POST',
                    body: JSON.stringify({ password, token, email })
                });
            }
        },

        // Complaints
        complaints: {
            async list(filters = {}) {
                const params = new URLSearchParams();
                for (const [k, v] of Object.entries(filters)) {
                    if (v !== undefined && v !== null && v !== '') params.append(k, v);
                }
                return await CampusCareAPI.request(`/api/complaints?${params.toString()}`);
            },

            async get(id) {
                return await CampusCareAPI.request(`/api/complaints/${encodeURIComponent(id)}`);
            },

            async create(formDataOrJson) {
                if (formDataOrJson instanceof FormData) {
                    return await CampusCareAPI.request('/api/complaints', {
                        method: 'POST',
                        body: formDataOrJson
                    });
                } else {
                    return await CampusCareAPI.request('/api/complaints', {
                        method: 'POST',
                        body: JSON.stringify(formDataOrJson)
                    });
                }
            },

            async updateStatus(id, status, note, teacherNotes) {
                return await CampusCareAPI.request(`/api/complaints/${encodeURIComponent(id)}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status, note, teacher_notes: teacherNotes })
                });
            },

            async updatePriority(id, priority) {
                return await CampusCareAPI.request(`/api/complaints/${encodeURIComponent(id)}/priority`, {
                    method: 'PATCH',
                    body: JSON.stringify({ priority })
                });
            },

            async updateNotes(id, teacherNotes) {
                return await CampusCareAPI.request(`/api/complaints/${encodeURIComponent(id)}/notes`, {
                    method: 'PATCH',
                    body: JSON.stringify({ teacher_notes: teacherNotes })
                });
            },

            async bulkStatus(ids, status, note) {
                return await CampusCareAPI.request('/api/complaints/bulk-status', {
                    method: 'POST',
                    body: JSON.stringify({ ids, status, note })
                });
            },

            async getAnalytics() {
                return await CampusCareAPI.request('/api/analytics');
            }
        }
    };

    // ===========================================
    // REALTIME LIVE EVENT STREAM
    // ===========================================
    const eventListeners = new Set();
    let sseSource = null;

    function initSSE() {
        if (typeof window === 'undefined' || !window.EventSource || sseSource) return;
        try {
            sseSource = new EventSource('/api/events');
            sseSource.onmessage = (event) => {
                try {
                    const parsed = JSON.parse(event.data);
                    for (const listener of eventListeners) {
                        listener(parsed);
                    }
                } catch (e) {}
            };
            sseSource.onerror = () => {
                // Auto-reconnect managed by browser
            };
        } catch (err) {}
    }

    // ===========================================
    // SUPABASE COMPATIBILITY BRIDGE
    // ===========================================
    class SupabaseQueryBuilder {
        constructor(table) {
            this.table = table;
            this.filters = {};
            this._select = '*';
            this._order = { column: 'created_at', ascending: false };
            this._limit = null;
            this._page = 0;
            this._isCountHead = false;
        }

        select(cols = '*', options = {}) {
            this._select = cols;
            if (options && options.count === 'exact' && options.head) {
                this._isCountHead = true;
            }
            return this;
        }

        eq(col, val) {
            this.filters[col] = val;
            return this;
        }

        in(col, vals) {
            if (Array.isArray(vals)) {
                this.filters[col] = vals.join(',');
            }
            return this;
        }

        ilike(col, pattern) {
            this.filters[col] = pattern.replace(/%/g, '');
            this.filters['search'] = pattern.replace(/%/g, '');
            return this;
        }

        or(conditions) {
            const matches = conditions.match(/%([^%]+)%/);
            if (matches && matches[1]) {
                this.filters['search'] = matches[1];
            }
            return this;
        }

        order(col, options = { ascending: false }) {
            this._order = { column: col, ascending: options.ascending !== false };
            this.filters['sort'] = this._order.ascending ? 'oldest' : 'newest';
            return this;
        }

        range(from, to) {
            const limit = to - from + 1;
            this.filters['limit'] = limit;
            this.filters['page'] = Math.floor(from / limit);
            return this;
        }

        async insert(rows) {
            const row = Array.isArray(rows) ? rows[0] : rows;
            try {
                if (this.table === 'complaints') {
                    const res = await CampusCareAPI.complaints.create(row);
                    return { data: res.data || row, error: null };
                } else if (this.table === 'complaint_status_history') {
                    return { data: row, error: null };
                }
                return { data: row, error: null };
            } catch (err) {
                return { data: null, error: err };
            }
        }

        update(payload) {
            this._updatePayload = payload;
            return this;
        }

        async single() {
            const { data, error } = await this.then(r => ({ data: r.data, error: r.error }));
            return {
                data: Array.isArray(data) ? data[0] : data,
                error
            };
        }

        then(resolve, reject) {
            const exec = async () => {
                try {
                    // Update operation
                    if (this._updatePayload) {
                        const id = this.filters['id'];
                        const ids = this.filters['id'] ? this.filters['id'].split(',') : null;

                        if (ids && ids.length > 1) {
                            await CampusCareAPI.complaints.bulkStatus(ids, this._updatePayload.status, 'Bulk update');
                            return { data: null, error: null };
                        } else if (id) {
                            if (this._updatePayload.status) {
                                const res = await CampusCareAPI.complaints.updateStatus(id, this._updatePayload.status, '', this._updatePayload.teacher_notes);
                                return { data: res.data, error: null };
                            } else if (this._updatePayload.priority) {
                                const res = await CampusCareAPI.complaints.updatePriority(id, this._updatePayload.priority);
                                return { data: res.data, error: null };
                            } else if (this._updatePayload.teacher_notes !== undefined) {
                                const res = await CampusCareAPI.complaints.updateNotes(id, this._updatePayload.teacher_notes);
                                return { data: res.data, error: null };
                            }
                        }
                        return { data: null, error: null };
                    }

                    // Count Query
                    if (this._isCountHead) {
                        const analytics = await CampusCareAPI.complaints.getAnalytics();
                        let count = analytics.total?.count || 0;
                        if (this.filters['status']) {
                            const st = String(this.filters['status']).toLowerCase();
                            if (st.includes('pending') || st.includes('submitted')) count = analytics.pending?.count || 0;
                            else if (st.includes('progress')) count = analytics.inProgress?.count || 0;
                            else if (st.includes('resolved') || st.includes('completed')) count = analytics.resolved?.count || 0;
                        }
                        return { count, data: null, error: null };
                    }

                    // Complaint by ID
                    if (this.filters['id']) {
                        const res = await CampusCareAPI.complaints.get(this.filters['id']);
                        return { data: [res.complaint], error: null };
                    }

                    // Complaint List Query
                    const data = await CampusCareAPI.complaints.list(this.filters);
                    return { data, error: null };

                } catch (err) {
                    return { data: null, error: err };
                }
            };

            return exec().then(resolve, reject);
        }
    }

    const supabaseClientBridge = {
        auth: {
            async signInWithPassword({ email, password }) {
                try {
                    const data = await CampusCareAPI.auth.login(email, password);
                    return { data: { user: data.user, session: { access_token: data.token } }, error: null };
                } catch (err) {
                    return { data: { user: null, session: null }, error: err };
                }
            },

            async signUp({ email, password, options = {} }) {
                try {
                    const metadata = options.data || {};
                    const payload = {
                        email,
                        password,
                        full_name: metadata.full_name || 'Student',
                        roll_number: metadata.roll_number || '',
                        role: metadata.role || 'student'
                    };
                    const data = await CampusCareAPI.auth.register(payload);
                    return { data: { user: data.user, session: { access_token: data.token } }, error: null };
                } catch (err) {
                    return { data: { user: null, session: null }, error: err };
                }
            },

            async getUser() {
                return await CampusCareAPI.auth.getUser();
            },

            async signOut() {
                return await CampusCareAPI.auth.logout();
            },

            async resetPasswordForEmail(email) {
                try {
                    const data = await CampusCareAPI.auth.forgotPassword(email);
                    return { data, error: null };
                } catch (err) {
                    return { data: null, error: err };
                }
            },

            async updateUser({ password }) {
                try {
                    const data = await CampusCareAPI.auth.resetPassword(password);
                    return { data, error: null };
                } catch (err) {
                    return { data: null, error: err };
                }
            }
        },

        from(table) {
            return new SupabaseQueryBuilder(table);
        },

        storage: {
            from(bucket) {
                return {
                    async upload(filePath, file) {
                        try {
                            const formData = new FormData();
                            formData.append('file', file);
                            const res = await CampusCareAPI.request('/api/upload', {
                                method: 'POST',
                                body: formData
                            });
                            return { data: { path: res.path }, error: null };
                        } catch (err) {
                            return { data: null, error: err };
                        }
                    },

                    getPublicUrl(path) {
                        const url = path.startsWith('http') || path.startsWith('/') ? path : `/${path}`;
                        return { data: { publicUrl: url } };
                    },

                    async createSignedUrl(path) {
                        const url = path.startsWith('http') || path.startsWith('/') ? path : `/${path}`;
                        return { data: { signedUrl: url }, error: null };
                    }
                };
            }
        },

        channel(channelName) {
            initSSE();
            const channelObj = {
                on(eventType, filter, callback) {
                    const cb = typeof filter === 'function' ? filter : callback;
                    eventListeners.add((event) => {
                        if (cb) cb({ new: event.payload, old: event.payload, eventType: event.type });
                    });
                    return channelObj;
                },
                subscribe() {
                    return channelObj;
                }
            };
            return channelObj;
        }
    };

    // Export Globally
    window.CampusCareAPI = CampusCareAPI;
    window.supabaseClient = supabaseClientBridge;
    window.supabase = {
        createClient: () => supabaseClientBridge
    };

    // Auto-init SSE on load
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            initSSE();
        });
    }

})();
