import { Link } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';

export function NotFoundPage(): JSX.Element {
  return (
    <PageContainer narrow>
      <Card title="Page not found" headingLevel={2}>
        <EmptyState
          icon="404"
          title="That page does not exist"
          description="The refund flow lives at / and the support dashboard at /admin."
          action={
            <Link className="button button--primary" to="/">
              Back to the refund request
            </Link>
          }
        />
      </Card>
    </PageContainer>
  );
}
