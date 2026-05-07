import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ access_token: string }>('/auth/login', { username, password }).then(r => r.data),
};
