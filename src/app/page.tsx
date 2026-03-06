"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, MessageCircle, ShoppingBag, X, Loader2, LogOut, UserPlus, LogIn, LayoutGrid, CheckCircle2, Sparkles } from 'lucide-react';
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
  setDocumentNonBlocking,
  errorEmitter
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { initiateEmailSignIn, initiateEmailSignUp, initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { FirebaseError } from 'firebase/app';
import { cn } from '@/lib/utils';

export default function Home() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSecretAdminUnlocked, setIsSecretAdminUnlocked] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const WHATSAPP_NUMBER = "917319965930";
  const ADMIN_SECRET_KEY = 'kela123';
  const ADMIN_VERIFICATION_CODE = '5930'; 

  useEffect(() => {
    if (searchQuery.toLowerCase() === ADMIN_SECRET_KEY) {
      if (!user) {
        setIsLoginDialogOpen(true);
      } else {
        setIsVerificationDialogOpen(true);
      }
      setSearchQuery('');
    }
  }, [searchQuery, user]);

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === ADMIN_VERIFICATION_CODE) {
      if (user) {
        const adminRef = doc(firestore, 'admin_roles', user.uid);
        setDocumentNonBlocking(adminRef, { assignedAt: new Date().toISOString() }, { merge: true }, { merge: true });
        
        setIsSecretAdminUnlocked(true);
        setIsVerificationDialogOpen(false);
        setVerificationCode('');
        toast({ 
          title: "Admin Access Granted", 
          description: "Your account is now registered. Click the Shield icon to manage your bazaar.",
        });
      }
    } else {
      toast({
        title: "Invalid Code",
        description: "The verification code is incorrect.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const handleAuthError = (error: FirebaseError) => {
      let message = "An authentication error occurred.";
      if (error.code === 'auth/invalid-credential') message = "Invalid email or password.";
      toast({ variant: "destructive", title: "Authentication Failed", description: message });
    };
    errorEmitter.on('auth-error', handleAuthError);
    return () => errorEmitter.off('auth-error', handleAuthError);
  }, [toast]);

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);

  const themeDocRef = useMemoFirebase(() => doc(firestore, 'publicDisplaySettings', 'theme'), [firestore]);
  const { data: themeData } = useDoc(themeDocRef);
  const currentTheme: FestivalTheme = (themeData?.activeThemeName as FestivalTheme) || 'Normal';

  const adminRoleRef = useMemoFirebase(() => user ? doc(firestore, 'admin_roles', user.uid) : null, [firestore, user]);
  const { data: adminRole } = useDoc(adminRoleRef);
  const isAdmin = !!adminRole;

  const statsDocRef = useMemoFirebase(() => isAdmin ? doc(firestore, 'storeSettings', 'mainSettings') : null, [firestore, isAdmin]);
  const { data: statsData } = useDoc(statsDocRef);
  const stats = {
    orders: statsData?.totalOrders || 0,
    earnings: statsData?.totalEarnings || 0
  };

  const filteredProductsBySection = useMemo(() => {
    if (!products) return {};
    const filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered.reduce((acc: any, product: any) => {
      const section = product.section || "General Bazaar";
      if (!acc[section]) acc[section] = [];
      acc[section].push(product);
      return acc;
    }, {});
  }, [products, searchQuery]);

  const currentThemeConfig = THEME_DATA[currentTheme];

  const handleAdminClick = () => {
    if (!user) setIsLoginDialogOpen(true);
    else if (!isAdmin && !isSecretAdminUnlocked) {
      toast({ title: "Access Restricted", description: "Type 'kela123' in search to start verification.", variant: "destructive" });
    } else setIsAdminPanelVisible(!isAdminPanelVisible);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isSignUp) initiateEmailSignUp(auth, email, password);
    else initiateEmailSignIn(auth, email, password);
    setIsLoginDialogOpen(false);
  };

  const handleBuy = (product: any) => {
    const message = `*Bounsi Bazaar Order Alert!*\n\nItem: ${product.name}\nPrice: ₹${product.price} / ${product.unit}\nSection: ${product.section}\n\nPlease confirm my order.`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const removeProduct = (id: string) => {
    const productRef = doc(firestore, 'products', id);
    deleteDocumentNonBlocking(productRef);
    toast({ title: "Removed", description: "Product deleted from catalog" });
  };

  if (isProductsLoading || isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen relative pb-20 overflow-x-hidden", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <nav className={cn(
        "sticky top-0 z-50 py-4 glass-nav transition-all duration-1000",
        currentTheme === 'Normal' ? 'bg-primary' : ''
      )}>
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-8 h-8 text-white animate-bounce" />
            <h1 className={cn(
              "text-3xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r",
              currentThemeConfig.gradient
            )}>
              {currentThemeConfig.title}
            </h1>
          </div>
          
          <div className="relative w-full md:w-1/2 group">
            <Input 
              placeholder="Search products or use secret key..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-14 rounded-full text-black bg-white/95 border-none shadow-2xl focus:ring-4 focus:ring-yellow-400/50 transition-all text-lg font-medium"
            />
            <Search className="absolute left-5 top-4.5 text-gray-400 w-6 h-6" />
            <Sparkles className="absolute right-5 top-4.5 text-yellow-500 w-5 h-5 animate-pulse" />
          </div>

          <div className="flex items-center gap-4">
            {(isAdmin || isSecretAdminUnlocked) && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleAdminClick}
                className="rounded-full h-14 w-14 hover:bg-white/20 text-white bg-white/10 backdrop-blur-md shadow-xl"
              >
                <ShieldCheck className="w-8 h-8" />
              </Button>
            )}
            <Badge variant="secondary" className="bg-green-500 text-white px-6 py-2 rounded-full animate-pulse flex items-center gap-2 border-none shadow-lg font-bold text-sm">
              <MessageCircle className="w-5 h-5" /> LIVE ORDERS
            </Badge>
          </div>
        </div>
      </nav>

      {(isAdmin || isSecretAdminUnlocked) && isAdminPanelVisible && (
        <div className="bg-white/5 backdrop-blur-2xl py-10 border-b border-white/10 animate-in fade-in slide-in-from-top-10 duration-700">
          <div className="container mx-auto px-4 mb-8 flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-black text-white flex items-center gap-3 drop-shadow-xl">
                <ShieldCheck className="w-8 h-8 text-yellow-400" /> BAZAAR CONTROL
              </h2>
              {isSecretAdminUnlocked && !isAdmin && (
                <p className="text-xs text-yellow-400 uppercase font-black tracking-widest mt-1">Status: Initializing Admin Node...</p>
              )}
            </div>
            <Button variant="outline" size="lg" onClick={handleLogout} className="rounded-full bg-white/10 text-white border-white/20 hover:bg-white/30 font-bold px-8 h-12">
              <LogOut className="w-5 h-5 mr-2" /> Logout
            </Button>
          </div>
          <AdminPanel stats={stats} currentTheme={currentTheme} onResetStats={() => {}} />
        </div>
      )}

      <main className="container mx-auto p-4 md:p-8 mt-8">
        {Object.keys(filteredProductsBySection).length === 0 ? (
          <div className="text-center py-40 bg-white/10 backdrop-blur-md rounded-[3rem] border border-white/20">
            <ShoppingBag className="w-24 h-24 mx-auto mb-6 text-gray-400 animate-pulse" />
            <p className="text-3xl font-black text-gray-400 uppercase tracking-tighter">No items in your basket</p>
          </div>
        ) : (
          <div className="space-y-20">
            {Object.entries(filteredProductsBySection).map(([sectionName, products]: [string, any]) => (
              <section key={sectionName} className="space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                <div className="flex items-center gap-6">
                  <div className={cn("p-4 rounded-[1.5rem] shadow-2xl rotate-3 bg-gradient-to-br", currentThemeConfig.gradient)}>
                    <LayoutGrid className="w-8 h-8 text-white" />
                  </div>
                  <h2 className={cn(
                    "text-4xl md:text-5xl font-black uppercase tracking-tighter festive-title bg-gradient-to-r",
                    currentThemeConfig.gradient
                  )}>
                    {sectionName}
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                  {products.map((p: any) => (
                    <div 
                      key={p.id} 
                      className="group product-card-premium rounded-[3rem] p-6 relative flex flex-col justify-between border border-white/20 shadow-xl overflow-hidden"
                    >
                      {(isAdmin || isSecretAdminUnlocked) && isAdminPanelVisible && (
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeProduct(p.id)}
                          className="absolute top-4 right-4 rounded-full w-10 h-10 shadow-2xl z-20 hover:rotate-90 transition-transform"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      )}
                      
                      <div className="relative overflow-hidden rounded-[2.5rem] h-60 mb-6 shadow-2xl bg-slate-100">
                        <img 
                          src={p.imageUrl} 
                          alt={p.name} 
                          className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-1000"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <Badge className="absolute top-4 left-4 bg-white/90 backdrop-blur-md text-primary border-none font-black text-xs px-4 py-1.5 rounded-full shadow-lg">
                          {p.category}
                        </Badge>
                      </div>

                      <div className="space-y-2 mb-6 px-2">
                        <h3 className="font-black text-gray-900 text-xl uppercase leading-none tracking-tighter group-hover:text-primary transition-colors">
                          {p.name}
                        </h3>
                        <div className="flex items-baseline gap-2">
                          <p className={cn("text-3xl font-black italic", currentThemeConfig.accent)}>
                            ₹{p.price}
                          </p>
                          <span className="text-sm font-black text-gray-400 uppercase">/ {p.unit}</span>
                        </div>
                      </div>

                      <Button 
                        onClick={() => handleBuy(p)}
                        className={cn(
                          "w-full h-16 rounded-[1.5rem] font-black text-lg uppercase tracking-widest shadow-2xl glow-button transition-all flex items-center justify-center gap-3 border-none",
                          "bg-gradient-to-r text-white",
                          currentThemeConfig.gradient
                        )}
                      >
                        ORDER <MessageCircle className="w-6 h-6" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Admin Dialogs - Same as before but with rounded-[3rem] and better padding */}
      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-primary" /> VERIFICATION
            </DialogTitle>
            <DialogDescription className="text-lg">
              Check your WhatsApp at <strong>+91 7319965930</strong> for the unlock code.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-8 py-6">
            <Input 
              maxLength={4}
              placeholder="0000" 
              className="text-center text-5xl h-24 tracking-[0.5em] font-black rounded-[2rem] border-4 focus:ring-8"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
            <Button type="submit" className="w-full h-16 rounded-[1.5rem] text-xl font-black uppercase tracking-widest flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6" /> UNLOCK BAZAAR
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black">{isSignUp ? 'NEW ADMIN' : 'ADMIN LOGIN'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAuthSubmit} className="space-y-6 py-6">
            <div className="space-y-3">
              <Label className="text-lg font-bold">Email Address</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 rounded-2xl" />
            </div>
            <div className="space-y-3">
              <Label className="text-lg font-bold">Secret Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 rounded-2xl" />
            </div>
            <Button type="submit" className="w-full h-16 rounded-[1.5rem] font-black text-lg">
              {isSignUp ? 'CREATE ACCOUNT' : 'SECURE SIGN IN'}
            </Button>
          </form>
          <Button variant="ghost" onClick={() => setIsSignUp(!isSignUp)} className="text-sm font-bold uppercase underline">
            {isSignUp ? 'Back to Sign In' : 'Create Admin Account'}
          </Button>
          <div className="relative my-4"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-black">Secure Tunnel</span></div></div>
          <Button variant="outline" onClick={() => initiateAnonymousSignIn(auth)} className="w-full h-14 rounded-2xl font-black">QUICK BYPASS</Button>
        </DialogContent>
      </Dialog>

      <footer className="text-center py-20 opacity-20 select-none">
        <p className="font-black text-6xl tracking-tighter uppercase mb-2 festive-title bg-gradient-to-r from-gray-400 to-gray-600">BOUNSI BAZAAR</p>
        <p className="text-sm uppercase font-black tracking-[0.5em]">Crafted with Love & Traditions</p>
      </footer>

      <Toaster />
    </div>
  );

  async function handleLogout() {
    await signOut(auth);
    setIsAdminPanelVisible(false);
    setIsSecretAdminUnlocked(false);
    toast({ title: "Logged Out", description: "Secure session terminated." });
  }
}