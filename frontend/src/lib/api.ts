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

  private getApiBase() {
    if (typeof window === 'undefined') return 'http://localhost:8080/api/v1'
    // 优先使用用户配置的地址
    const configured = localStorage.getItem('api_url')
    if (configured) return configured
    // 尝试从环境变量获取
    const env = process.env.NEXT_PUBLIC_API_URL
    if (env) return env
    // 自动检测：使用当前页面的协议和主机，后端默认端口 8080
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:8080/api/v1`
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

    const apiBase = this.getApiBase()
    const response = await fetch(`${apiBase}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers as Record<string, string> },
    }).catch((err) => {
      throw new Error(`无法连接到服务器，请检查网络或API地址设置 (${err.message})`)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `请求失败 (${response.status})` }))
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

  // Users management
  async getUsers() {
    return this.request<any[]>('/users')
  }

  async getUser(id: number) {
    return this.request<any>(`/users/${id}`)
  }

  async updateUser(id: number, data: { nickname?: string; email?: string; role?: string; is_active?: boolean }) {
    return this.request<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id: number) {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    })
  }

  async updatePassword(id: number, newPassword: string, oldPassword?: string) {
    return this.request<{ message: string }>(`/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ new_password: newPassword, old_password: oldPassword || '' }),
    })
  }

  // Categories
  async getCategories(format?: 'tree') {
    const query = format ? `?format=${format}` : ''
    return this.request<any[]>(`/categories${query}`)
  }

  async createCategory(data: { name: string; description?: string; color?: string; icon?: string; parent_id?: number | null; sort_order?: number }) {
    return this.request<any>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCategory(id: number, data: { name: string; description?: string; color?: string; icon?: string; parent_id?: number | null; sort_order?: number }) {
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

  async reorderCategories(items: Array<{ id: number; parent_id?: number | null; sort_order: number }>) {
    return this.request<{ message: string }>('/categories/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
  }

  // Locations
  async getLocations(format?: 'tree') {
    const query = format ? `?format=${format}` : ''
    return this.request<any[]>(`/locations${query}`)
  }

  async createLocation(data: { name: string; description?: string; icon?: string; parent_id?: number | null; sort_order?: number }) {
    return this.request<any>('/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateLocation(id: number, data: { name: string; description?: string; icon?: string; parent_id?: number | null; sort_order?: number }) {
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

  async reorderLocations(items: Array<{ id: number; parent_id?: number | null; sort_order: number }>) {
    return this.request<{ message: string }>('/locations/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
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

  // AI Recognition
  async getAIStatus() {
    return this.request<{ configured: boolean; provider: string; model: string }>('/ai/status')
  }

  async getAIProviders() {
    return this.request<{ providers: Array<{ id: string; name: string; description: string; models: string[] }> }>('/ai/providers')
  }

  async recognizeFromImage(file: File, type: 'product' | 'receipt' | 'barcode' = 'product') {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const headers: Record<string, string> = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const apiBase = this.getApiBase()
    const response = await fetch(`${apiBase}/ai/recognize`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Recognition failed' }))
      throw new Error(error.error || 'Recognition failed')
    }

    return response.json() as Promise<{
      items: Array<{
        name: string
        barcode?: string
        quantity?: number
        unit?: string
        price?: number
        cost?: number
        expired_at?: string
        description?: string
        category?: string
        brand?: string
        confidence: number
      }>
      provider: string
      model: string
      file_url?: string
    }>
  }

  async batchCreateItems(items: Array<{
    name: string
    barcode?: string
    quantity?: number
    unit?: string
    price?: number
    cost?: number
    expired_at?: string
    description?: string
    category_id?: number
    location_id?: number
  }>) {
    return this.request<{ items: any[]; created: number; failed: number; errors: string[] }>('/items/batch', {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
  }

  // File Upload
  async uploadFile(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const headers: Record<string, string> = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const apiBase = this.getApiBase()
    const response = await fetch(`${apiBase}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(error.error || 'Upload failed')
    }

    return response.json() as Promise<{
      id: string
      name: string
      url: string
      size: number
      mime_type: string
    }>
  }
}

export const api = new ApiClient()
