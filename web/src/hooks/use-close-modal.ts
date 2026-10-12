import { useLocation, useNavigate } from 'react-router-dom';

// Modal routes close with history back, but when the route was the first entry
// (PWA reopened on /compras/:id, a reload, a shared link) there is nothing to go
// back to — `navigate(-1)` would do nothing or leave the app. Fall back to Home.
export function useCloseModal() {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key === 'default') navigate('/', { replace: true });
    else navigate(-1);
  };
}
