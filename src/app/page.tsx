"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, MessageCircle, ShoppingBag, X, Loader2, Copy, LogOut, UserPlus, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { THEME_DATA, FestivalTheme } from '@/app/lib/constants';
import { AdminPanel } from '@/components/AdminPanel';
import { FestiveEffects } from '@/components/FestiveEffects';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { 
  useCollection, 
  useDoc, 
  useFirestore, 
  useAuth, 
  useUser, 
  useMemoFirebase,
  deleteDocumentNonBlocking,
  errorEmitter
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { initiateEmailSignIn, initiateEmailSignUp, initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { FirebaseError } from 'firebase/app';

export default function Home() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const WHATSAPP_NUMBER = "917319965930";

  // Listen for Auth Errors globally
  useEffect(() => {
    const handleAuthError = (error: FirebaseError) => {
      let message = "An authentication error occurred.";
      if (error.code === 'auth/invalid-credential') {
        message = "Invalid email or password. Please check your credentials.";
      } else if (error.code === 'auth/email-already-in-use') {
        message = "This email is already registered. Try signing in instead.";
      } else if (error.code === 'auth/weak-password') {
        message = "Password should be at least 6 characters.";
      } else if (error.code === 'auth/operation-not-allowed') {
        message = "Email/Password login is not enabled in Firebase Console.";
      }
      
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: message
      });
    };

    errorEmitter.on('auth-error', handleAuthError);
    return () => errorEmitter.off('auth-error', handleAuthError);
  }, [toast]);

  // Products Listener
  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);

  // Public Theme Listener
  const themeDocRef = useMemoFirebase(() => doc(firestore, 'publicDisplaySettings', 'theme'), [firestore]);
  const { data: themeData } = useDoc(themeDocRef);
  const currentTheme: FestivalTheme = (themeData?.activeThemeName as FestivalTheme) || 'Normal';

  // Admin Role Check
  const adminRoleRef = useMemoFirebase(() => user ? doc(firestore, 'admin_roles', user.uid) : null, [firestore, user]);
  const { data: adminRole } = useDoc(adminRoleRef);
  const isAdmin = !!adminRole;

  // Store Settings Listener
  const statsDocRef = useMemoFirebase(() => isAdmin ? doc(firestore, 'storeSettings', 'mainSettings') : null, [firestore, isAdmin]);
  const { data: statsData } = useDoc(statsDocRef);
  const stats = {
    orders: statsData?.totalOrders || 0,
    earnings: statsData?.totalEarnings || 0
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [products, searchQuery]);

  const handleAdminClick = () => {
    if (!user) {
      setIsLoginDialogOpen(true);
    } else if (!isAdmin) {
      toast({ 
        title: "Admin Access Denied", 
        description: "You are logged in but do not have admin rights.",
        variant: "destructive"
      });
      setIsAdminPanelVisible(false);
    } else {
      setIsAdminPanelVisible(!isAdminPanelVisible);
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    if (isSignUp) {
      initiateEmailSignUp(auth, email, password);
    } else {
      initiateEmailSignIn(auth, email, password);
    }
    
    setIsLoginDialogOpen(false);
    setEmail('');
    setPassword('');
  };

  const handleAnonymousLogin = () => {
    initiateAnonymousSignIn(auth);
    setIsLoginDialogOpen(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdminPanelVisible(false);
    toast({ title: "Logged Out", description: "You have been signed out." });
  };

  const handleBuy = (product: any) => {
    const message = `*Bounsi Bazaar Order Alert!*\n\nItem: ${product.name}\nPrice: ₹${product.price}\n\nPlease confirm my order.`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const removeProduct = (id: string) => {
    const productRef = doc(firestore, 'products', id);
    deleteDocumentNonBlocking(productRef);
    toast({ title: "Removed", description: "Product deleted from catalog" });
  };

  const copyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      toast({ title: "UID Copied", description: "Add this UID to 'admin_roles' in console." });
    }
  };

  const currentThemeConfig = THEME_DATA[currentTheme];

  if (isProductsLoading || isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${currentThemeConfig.bg} relative transition-colors duration-1000 pb-20`}>
      <FestiveEffects theme={currentTheme} />
      
      <nav className={`${currentThemeConfig.nav} p-4 text-white sticky top-0 z-50 shadow-2xl transition-all duration-700`}>
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-black italic tracking-tighter uppercase drop-shadow-md">
            {currentThemeConfig.title}
          </h1>
          
          <div className="relative w-full md:w-1/2 group">
            <Input 
              placeholder="Search products..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-12 rounded-full text-black bg-white/95 border-none shadow-inner focus:ring-4 focus:ring-yellow-400/50 transition-all"
            />
            <Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" />
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleAdminClick}
              className={`rounded-full h-12 w-12 hover:bg-white/20 text-white ${isAdmin && isAdminPanelVisible ? 'bg-white/30' : ''}`}
            >
              <ShieldCheck className="w-6 h-6" />
            </Button>
            <Badge variant="secondary" className="bg-green-500 text-white px-4 py-1.5 rounded-full animate-pulse flex items-center gap-2 border-none">
              <MessageCircle className="w-4 h-4" /> LIVE ORDERS
            </Badge>
          </div>
        </div>
      </nav>

      {user && !isAdmin && (
        <div className="bg-yellow-100 p-4 border-b border-yellow-200 flex flex-col items-center justify-center gap-2">
          <p className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
            Logged in but not an Admin. Add this UID to 'admin_roles' collection:
          </p>
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-md border border-yellow-300 shadow-sm">
            <code className="text-xs font-mono">{user.uid}</code>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyUid}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={handleLogout}>
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {isAdmin && isAdminPanelVisible && (
        <div className="bg-background/80 backdrop-blur-md pt-8 border-b">
          <div className="container mx-auto px-4 mb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-2 rounded-full">
              <LogOut className="w-4 h-4" /> Logout Admin
            </Button>
          </div>
          <AdminPanel 
            stats={stats} 
            currentTheme={currentTheme}
            onResetStats={() => {
              const mainSettingsRef = doc(firestore, 'storeSettings', 'mainSettings');
              const publicThemeRef = doc(firestore, 'publicDisplaySettings', 'theme');
              deleteDocumentNonBlocking(mainSettingsRef);
              deleteDocumentNonBlocking(publicThemeRef);
              toast({ title: "Settings Reset", description: "Stats cleared" });
            }}
          />
        </div>
      )}

      <main className="container mx-auto p-6 mt-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4" />
            <p className="text-xl font-bold">No products found matching your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredProducts.map((p: any) => (
              <div 
                key={p.id} 
                className="group bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl border border-border/40 p-5 relative flex flex-col justify-between product-card-hover animate-in fade-in zoom-in duration-300"
              >
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => removeProduct(p.id)}
                    className="absolute top-3 right-3 rounded-full w-8 h-8 shadow-lg z-20"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
                
                <div className="relative overflow-hidden rounded-[2rem] h-48 mb-4 shadow-inner bg-slate-100">
                  <img 
                    src={p.imageUrl} 
                    alt={p.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <Badge className="absolute top-3 left-3 bg-white/80 backdrop-blur-sm text-primary border-none font-bold">
                    {p.category}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-gray-800 text-lg uppercase leading-tight line-clamp-2">
                    {p.name}
                  </h3>
                  <p className={`text-2xl font-black italic ${currentThemeConfig.accent}`}>
                    ₹{p.price}
                  </p>
                </div>

                <Button 
                  onClick={() => handleBuy(p)}
                  className="mt-6 w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:scale-[0.98] transition-all bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center gap-2"
                >
                  ORDER NOW <MessageCircle className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <DialogContent className="rounded-[2.5rem]">
          <DialogHeader>
            <DialogTitle>{isSignUp ? 'Create Admin Account' : 'Admin Login'}</DialogTitle>
            <DialogDescription>
              {isSignUp 
                ? 'Register your email to get a UID for admin verification.' 
                : 'Sign in to manage your store products and festival themes.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAuthSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="admin@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full rounded-xl flex items-center gap-2">
              {isSignUp ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </form>
          
          <Button 
            variant="ghost" 
            onClick={() => setIsSignUp(!isSignUp)} 
            className="w-full text-xs underline"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
          </div>
          <Button variant="outline" onClick={handleAnonymousLogin} className="w-full rounded-xl">
            Quick Anonymous Login
          </Button>
          <DialogFooter className="text-xs text-muted-foreground text-center">
            Note: Ensure "Email/Password" and "Anonymous" providers are enabled in your Firebase Console.
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="text-center py-10 opacity-40 select-none">
        <p className="font-black text-4xl tracking-tighter">BOUNSI BAZAAR</p>
        <p className="text-xs uppercase font-bold mt-2">Crafted for Festivals & Celebration</p>
      </footer>

      <Toaster />
    </div>
  );
}
