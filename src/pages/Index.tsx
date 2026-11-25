import { Navigate } from 'react-router';

/** The map works without an account, so the app opens straight onto it. */
const Index = () => <Navigate to="/home" replace />;

export default Index;
