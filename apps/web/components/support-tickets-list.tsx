'use client';

interface SupportTicket {
  id: string;
  playerId: string;
  category: string;
  message: string;
  response: string | null;
  status: string;
  robuxValue: number | null;
  autoResolved: boolean;
  createdAt: string;
}

interface SupportTicketsListProps {
  tickets: SupportTicket[];
  onResolve?: (ticketId: string) => void;
}

function getCategoryBadge(category: string) {
  const styles: Record<string, string> = {
    bug: 'bg-red-400/10 text-red-400',
    refund: 'bg-orange-400/10 text-orange-400',
    'how-to': 'bg-blue-400/10 text-blue-400',
    feature: 'bg-purple-400/10 text-purple-400',
    toxic: 'bg-red-600/10 text-red-500',
    positive: 'bg-green-400/10 text-green-400',
  };
  return styles[category] ?? 'bg-gray-400/10 text-gray-400';
}

function getStatusStyle(status: string) {
  if (status === 'resolved') return 'text-green-400';
  if (status === 'escalated') return 'text-yellow-400';
  return 'text-gray-400';
}

export function SupportTicketsList({ tickets, onResolve }: SupportTicketsListProps) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 font-semibold text-white">Support Tickets</h3>
        <div className="flex h-32 items-center justify-center text-gray-500">
          No support tickets yet. Tickets appear when players contact support.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-4 font-semibold text-white">Support Tickets</h3>
      <div className="space-y-3">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="rounded-lg border border-gray-800 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryBadge(ticket.category)}`}>
                    {ticket.category}
                  </span>
                  <span className={`text-xs font-medium ${getStatusStyle(ticket.status)}`}>
                    {ticket.status}
                  </span>
                  {ticket.autoResolved && (
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-400">
                      auto-resolved
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-gray-300">{ticket.message}</p>
                {ticket.response && (
                  <div className="mt-2 rounded-md bg-gray-800/50 p-2">
                    <p className="text-xs text-gray-400">Response:</p>
                    <p className="text-sm text-gray-300">{ticket.response}</p>
                  </div>
                )}
              </div>
              <div className="ml-4 text-right">
                {ticket.robuxValue !== null && ticket.robuxValue > 0 && (
                  <p className="text-sm font-medium text-orange-400">
                    {ticket.robuxValue} R$
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {new Date(ticket.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {ticket.status === 'escalated' && onResolve && (
                  <button
                    onClick={() => onResolve(ticket.id)}
                    className="mt-2 rounded-md bg-green-600/20 px-3 py-1 text-xs font-medium text-green-400 hover:bg-green-600/30"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
