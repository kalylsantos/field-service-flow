import { ServiceOrder, ServiceOrderStatus, STATUS_LABELS } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin, User, Calendar, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrdersTableProps {
  orders: ServiceOrder[];
  selectedOrders: string[];
  onSelectOrder: (orderId: string) => void;
  onSelectAll: () => void;
  onOrderClick?: (order: ServiceOrder) => void;
}

export function OrdersTable({
  orders,
  selectedOrders,
  onSelectOrder,
  onSelectAll,
  onOrderClick,
}: OrdersTableProps) {
  const allSelected = orders.length > 0 && selectedOrders.length === orders.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onSelectAll}
          aria-label="Selecionar todos"
        />
        <span className="text-sm text-muted-foreground">
          {selectedOrders.length > 0
            ? `${selectedOrders.length} selecionadas`
            : 'Selecionar todos'}
        </span>
      </div>

      <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
        {orders.map((order) => (
          <Card
            key={order.id}
            className={cn(
              'border-0 shadow-card cursor-pointer transition-all hover:scale-[1.01]',
              selectedOrders.includes(order.id) && 'ring-2 ring-primary'
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedOrders.includes(order.id)}
                  onCheckedChange={() => onSelectOrder(order.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1"
                />
                <div
                  className="flex-1 min-w-0"
                  onClick={() => onOrderClick?.(order)}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono font-semibold text-sm">
                      {order.sequencial || order.protocol || order.id}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">
                        {order.address}, {order.number} - {order.neighborhood}
                      </span>
                    </div>

                    {order.service_type && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{order.service_type}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      {order.scheduled_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{order.scheduled_date}</span>
                        </div>
                      )}

                      {order.profiles && (
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate text-xs">
                            {order.profiles.full_name || order.profiles.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma ordem de serviço encontrada
          </div>
        )}
      </div>
    </div>
  );
}
