export interface User {
    id:         string;
    email:      string;
    firstName:  string;
    lastName:   string;
    avatar?:    string;
    role:       'user' | 'admin';
}

export type AuthStep =
    | 'email'
    | 'login'
    | 'register'
    | 'verify'
    | 'reset'
    | 'success';
