const API_BASE = typeof window !== 'undefined'
  ? (localStorage.getItem('api_url') || 'http://localhost:8080/api/v1')
  : 'http://localhost:8080/api/v1'

class ApiClient {
  private token: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token')
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token)
      } else {
        localStorage.removeItem('token')
      }
    }
  }

  getToken() {
    return this.token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers as Record<string, string> },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }

    return response.json()
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    this.setToken(data.token)
    return data
  }

  async register(username: string, email: string, password: string, nickname?: string) {
    const data = await this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, nickname }),
    })
    this.setToken(data.token)
    return data
  }

  logout() {
    this.setToken(null)
  }

  async getProfile() {
    return this.request<any>('/profile')
  }

  // Categories
  async getCategories() {
    return this.request<any[]>('/categories')
  }

  async createCategory(data: { name: string; description?: string; color?: string; icon?: string }) {
    return this.request<any>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCategory(id: number, data: { name: string; description?: string; color?: string; icon?: string }) {
    return this.request<any>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCategory(id: number) {
    return this.request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    })
  }

  // Locations
  async getLocations() {
    return this.request<any[]>('/locations')
  }

  async createLocation(data: { name: string; description?: string; icon?: string }) {
    return this.request<any>('/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateLocation(id: number, data: { name: string; description?: string; icon?: string }) {
    return this.request<any>(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteLocation(id: number) {
    return this.request<{ message: string }>(`/locations/${id}`, {
      method: 'DELETE',
    })
  }

  // Items
  async getItems(params?: { category_id?: number; location_id?: number; search?: string }) {
    const query = new URLSearchParams()
    if (params?.category_id) query.set('category_id', params.category_id.toString())
    if (params?.location_id) query.set('location_id', params.location_id.toString())
    if (params?.search) query.set('search', params.search)
    const queryString = query.toString()
    return this.request<any[]>(`/items${queryString ? '?' + queryString : ''}`)
  }

  async getItem(id: number) {
    return this.request<any>(`/items/${id}`)
  }

  async getItemByBarcode(barcode: string) {
    return this.request<any>(`/items/barcode/${barcode}`)
  }

  async createItem(data: {
    name: string
    barcode?: string
    quantity?: number
    unit?: string
    price?: number
    cost?: number
    expired_at?: string
    image_url?: string
    description?: string
    note?: string
    alert_days?: number
    category_id?: number
    location_id?: number
  }) {
    return this.request<any>('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateItem(id: number, data: {
    name: string
    barcode?: string
    quantity?: number
    unit?: string
    price?: number
    cost?: number
    expired_at?: string
    image_url?: string
    description?: string
    note?: string
    alert_days?: number
    category_id?: number
    location_id?: number
  }) {
    return this.request<any>(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteItem(id: number) {
    return this.request<{ message: string }>(`/items/${id}`, {
      method: 'DELETE',
    })
  }

  // Transactions
  async getTransactions(itemId?: number) {
    const query = itemId ? `?item_id=${itemId}` : ''
    return this.request<any[]>(`/transactions${query}`)
  }

  async createTransaction(data: {
    type: 'in' | 'out' | 'adjust' | 'consume'
    quantity: number
    price?: number
    note?: string
    item_id: number
  }) {
    return this.request<any>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Dashboard
  async getStats() {
    return this.request<any>('/dashboard/stats')
  }
}

export const api = new ApiClient()
