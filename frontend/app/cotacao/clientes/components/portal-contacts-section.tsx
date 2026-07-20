'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import { addPortalContact, deletePortalContact, usePortalContacts } from '@/hooks/use-portal-contacts';
import type { PortalContact } from '@/types/client';

interface PortalContactsSectionProps {
  clientId: string;
}

function ContactRow({
  contact,
  onDelete,
}: {
  contact: PortalContact;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-md border">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{contact.email}</p>
        {contact.name && (
          <p className="text-xs text-muted-foreground truncate">{contact.name}</p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => onDelete(contact.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function PortalContactsSection({ clientId }: PortalContactsSectionProps) {
  const { contacts, isLoading } = usePortalContacts(clientId);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const result = await addPortalContact(clientId, {
      email: email.trim(),
      name: name.trim() || undefined,
    });
    if (result) {
      setEmail('');
      setName('');
    }
    setSubmitting(false);
  };

  const handleDelete = async (contactId: string) => {
    await deletePortalContact(clientId, contactId);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        E-mails autorizados a se cadastrar no portal do cliente. Não precisa ser o mesmo e-mail
        do contato principal do DNA — útil quando mais de uma pessoa do cliente (ou um analista
        Freitas que também quer ver a experiência do portal) precisa de acesso próprio.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemplo.com"
          required
          className="flex-1"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (opcional)"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={submitting || !email.trim()}>
          {submitting ? 'Adicionando...' : 'Adicionar'}
        </Button>
      </form>

      {isLoading ? (
        <LoaderComponent />
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum acesso ao portal cadastrado.
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <ContactRow key={c.id} contact={c} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
