// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n/provider';
import { Input } from './input';

/**
 * Yang dijaga: pesan "wajib diisi" ikut bahasa aplikasi, bukan bahasa browser.
 * Balon bawaan berbunyi "Please fill out this field." di tengah UI berbahasa
 * Indonesia — kelihatan seperti produk setengah jadi di depan calon pembeli.
 */
describe('Input', () => {
  afterEach(cleanup);

  it('memakai pesan aplikasi saat field wajib dibiarkan kosong', () => {
    render(
      <I18nProvider>
        <Input required aria-label="Nama Depan" />
      </I18nProvider>
    );

    const input = screen.getByLabelText('Nama Depan') as HTMLInputElement;
    expect(input.checkValidity()).toBe(false);
    expect(input.validationMessage).toBe('Wajib diisi');
  });

  it('membersihkan pesan begitu field diisi, supaya tidak tersangkut invalid', () => {
    render(
      <I18nProvider>
        <Input required aria-label="Nama Depan" />
      </I18nProvider>
    );

    const input = screen.getByLabelText('Nama Depan') as HTMLInputElement;
    input.checkValidity();
    input.value = 'Maya';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(input.validationMessage).toBe('');
    expect(input.checkValidity()).toBe(true);
  });
});
