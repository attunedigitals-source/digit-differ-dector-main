import type { DerivAccount } from "@/hooks/useDerivWebSocket";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Check, CircleDollarSign, TestTube } from "lucide-react";

interface AccountSelectorProps {
  accounts: DerivAccount[];
  activeLoginId: string | null;
  onSelectAccount: (loginid: string) => void;
}

export function AccountSelector({ accounts, activeLoginId, onSelectAccount }: AccountSelectorProps) {
  if (accounts.length === 0) return null;

  const realAccounts = accounts.filter((a) => !a.is_virtual);
  const demoAccounts = accounts.filter((a) => a.is_virtual);

  const activeAccount = accounts.find((a) => a.loginid === activeLoginId);
  const defaultTab = activeAccount?.is_virtual ? "demo" : "real";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CircleDollarSign className="w-4 h-4 text-primary" />
        Account Balances
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="real" className="text-xs">
            Real ({realAccounts.length})
          </TabsTrigger>
          <TabsTrigger value="demo" className="text-xs">
            <TestTube className="w-3 h-3 mr-1" />
            Demo ({demoAccounts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="real">
          <div className="grid gap-2">
            {realAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">No real accounts found</p>
            ) : (
              realAccounts.map((acc) => (
                <AccountCard
                  key={acc.loginid}
                  account={acc}
                  isActive={acc.loginid === activeLoginId}
                  onSelect={() => onSelectAccount(acc.loginid)}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="demo">
          <div className="grid gap-2">
            {demoAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">No demo accounts found</p>
            ) : (
              demoAccounts.map((acc) => (
                <AccountCard
                  key={acc.loginid}
                  account={acc}
                  isActive={acc.loginid === activeLoginId}
                  onSelect={() => onSelectAccount(acc.loginid)}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccountCard({
  account,
  isActive,
  onSelect,
}: {
  account: DerivAccount;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      onClick={onSelect}
      className={`cursor-pointer transition-all ${
        isActive
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-primary/40"
      }`}
    >
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground font-mono">{account.loginid}</span>
          <span className="text-lg font-bold text-foreground font-mono">
            {account.balance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-xs font-normal text-muted-foreground">{account.currency}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {account.is_virtual && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              DEMO
            </span>
          )}
          {isActive && <Check className="w-4 h-4 text-primary" />}
        </div>
      </CardContent>
    </Card>
  );
}
