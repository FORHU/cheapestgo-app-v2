import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { RegisterForm } from './register-form';

/**
 * The sign-up form. What it sends has to be in api-v2's field names: the API strips keys it
 * does not know, so a name sent as `firstName` is dropped and the account is saved nameless,
 * with a 201 and no error to show for it.
 */

const mutate = vi.hoisted(() => vi.fn());

vi.mock('@/features/auth/hooks/use-auth',() => ({ useRegister: () => ({ mutate, isPending: false }) }));
vi.mock('./social-login-buttons', () => ({ SocialLoginButtons: () => null }));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...rest} />,
}));

const fill = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

const submit = (fields: { first?: string; last?: string }) => {
    render(
        <NextIntlClientProvider locale="en" messages={en as never}>
            <RegisterForm />
        </NextIntlClientProvider>,
    );
    if (fields.first !== undefined) fill(en.auth.firstName, fields.first);
    if (fields.last !== undefined) fill(en.auth.lastName, fields.last);
    fill('Email', 'jose@example.com');
    fill('Password', 'Passw0rdX');
    fireEvent.click(screen.getByRole('button', { name: en.auth.createAccount }));
};

beforeEach(() => mutate.mockClear());

describe('the sign-up form', () => {
    it('sends the names under the keys the API reads', () => {
        submit({ first: 'José', last: 'Nguyễn' });
        expect(mutate).toHaveBeenCalledWith({
            email: 'jose@example.com',
            password: 'Passw0rdX',
            first_name: 'José',
            last_name: 'Nguyễn',
        });
    });

    it('leaves out a last name that was not given, which the API would refuse as blank', () => {
        submit({ first: ' José ', last: '  ' });
        expect(mutate).toHaveBeenCalledWith({
            email: 'jose@example.com',
            password: 'Passw0rdX',
            first_name: 'José',
            last_name: undefined,
        });
    });

    it('refuses a first name that is only spaces', () => {
        submit({ first: '   ' });
        expect(mutate).not.toHaveBeenCalled();
        expect(screen.getByText(en.auth.firstNameRequired)).toBeInTheDocument();
    });

    it('stops both names at the 30 characters the API allows', () => {
        submit({ first: 'José' });
        expect(screen.getByLabelText(en.auth.firstName)).toHaveAttribute('maxLength', '30');
        expect(screen.getByLabelText(en.auth.lastName)).toHaveAttribute('maxLength', '30');
    });
});
