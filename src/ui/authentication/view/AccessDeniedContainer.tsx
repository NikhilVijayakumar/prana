import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccessDeniedView } from './AccessDeniedView';

export const AccessDeniedContainer: FC = () => {
  const navigate = useNavigate();

  return (
    <AccessDeniedView
      onRetry={() => navigate('/splash')}
      onBackToLogin={() => navigate('/login')}
    />
  );
};
