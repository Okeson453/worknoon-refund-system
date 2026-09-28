import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { Button } from '../common/Button';
import { formatCurrency } from '../../utils/formatCurrency';
import type { OrderItemDto } from '../../types/customer';

export interface ItemSelectorProps {
  items: OrderItemDto[];
  selectedItemIds: string[];
  onToggle: (itemId: string) => void;
  onSelectAll: () => void;
  selectedTotalCents: number;
  disabled?: boolean;
}

function ItemFlags({ item }: { item: OrderItemDto }): JSX.Element {
  return (
    <span className="selection-option__meta">
      {item.finalSale ? <Badge tone="negative">Final sale</Badge> : null}
      {item.damaged ? <Badge tone="caution">Damage on record</Badge> : null}
      {item.incorrectItem ? <Badge tone="caution">Wrong item on record</Badge> : null}
      {!item.finalSale && !item.damaged && !item.incorrectItem ? <span>No issues recorded</span> : null}
    </span>
  );
}

export function ItemSelector({
  items,
  selectedItemIds,
  onToggle,
  onSelectAll,
  selectedTotalCents,
  disabled = false,
}: ItemSelectorProps): JSX.Element {
  return (
    <Card
      title="3. Items"
      hint="Pick every item the refund is about"
      actions={
        items.length > 1 ? (
          <Button size="small" variant="ghost" onClick={onSelectAll} disabled={disabled}>
            Toggle all
          </Button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState icon="▤" title="Select an order first" description="Items of the chosen order appear here." />
      ) : (
        <>
          <div className="selection-list">
            {items.map((item) => {
              const isSelected = selectedItemIds.includes(item.id);
              return (
                <label key={item.id} className={isSelected ? 'selection-option is-selected' : 'selection-option'}>
                  <input
                    type="checkbox"
                    className="selection-option__input"
                    checked={isSelected}
                    onChange={() => onToggle(item.id)}
                    disabled={disabled}
                  />
                  <span className="selection-option__body">
                    <span className="selection-option__title">
                      {item.productName} · {formatCurrency(item.priceCents * item.quantity)}
                    </span>
                    <ItemFlags item={item} />
                  </span>
                </label>
              );
            })}
          </div>
          <p className="form-field__hint" aria-live="polite">
            {selectedItemIds.length} selected · {formatCurrency(selectedTotalCents)} refund amount
          </p>
        </>
      )}
    </Card>
  );
}
