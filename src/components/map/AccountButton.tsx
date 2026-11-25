import { LogIn, LogOut, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { clearSession, displayName, initials } from '@/lib/session';
import type { StoredUser } from '@/lib/storedUser';

/** The avatar at the end of the search bar, or a sign in button. */
const AccountButton = ({ user }: { user: StoredUser | null }) => {
  const navigate = useNavigate();

  if (!user) {
    return (
      <Button asChild size="sm" className="h-10 shrink-0 px-4">
        <Link to="/login"><LogIn /> Sign in</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account"
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-semibold text-background"
        >
          {initials(user)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64">
        <DropdownMenuLabel className="px-3 py-2">
          <span className="block truncate text-[14px] font-semibold">{displayName(user)}</span>
          <span className="block truncate text-[12px] font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <UserRound /> Profile and emergency contact
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            clearSession();
            navigate('/login');
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AccountButton;
