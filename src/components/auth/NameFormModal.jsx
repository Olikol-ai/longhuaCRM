import { useState } from "react";
import { api } from '@/api';
import { Button, Input } from "@/design-system";

export default function NameFormModal({ onSave }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Заполните оба поля");
      return;
    }

    setSaving(true);
    try {
      await api.auth.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      onSave({ first_name: firstName.trim(), last_name: lastName.trim() });
    } catch (err) {
      setError(err.message || "Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 page-pad">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-form-title"
        className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-md border border-border"
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 id="name-form-title" className="text-lg font-bold text-foreground">Введите ваше имя</h2>
        </div>

        <form onSubmit={handleSave}>
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Пожалуйста, заполните ваше имя для продолжения работы в системе.
            </p>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1" htmlFor="name-form-last">
                Фамилия *
              </label>
              <Input
                id="name-form-last"
                placeholder="Янчиленко"
                value={lastName}
                autoComplete="family-name"
                autoFocus
                onChange={(e) => {
                  setLastName(e.target.value);
                  setError("");
                }}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1" htmlFor="name-form-first">
                Имя *
              </label>
              <Input
                id="name-form-first"
                placeholder="Мария"
                value={firstName}
                autoComplete="given-name"
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setError("");
                }}
                className="w-full"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex gap-3">
            <Button
              type="submit"
              intent="primary"
              loading={saving}
              className="flex-1"
            >
              Продолжить
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
