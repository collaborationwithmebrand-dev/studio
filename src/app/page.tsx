
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, MessageCircle, ShoppingBag, Loader2, LogOut, LayoutGrid, Clock, Phone, Pin, Smartphone, Wallet, Banknote, PhoneCall, QrCode } from 'lucide-react';
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
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  initiateAnonymousSignIn
} from '@/firebase';
import { collection, doc, query, where, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { cn } from '@/lib/utils';

export default function Home() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const [verificationCode, setVerificationCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSecretAdminUnlocked, setIsSecretAdminUnlocked] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const ADMIN_SECRET_KEY = 'kela123';
  const ADMIN_VERIFICATION_CODE = '5930'; 

  // Auto-sign in anonymously if not logged in to enable Firestore access
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const profileRef = useMemoFirebase(() => user ? doc(firestore, 'userProfiles', user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(profileRef);

  const storeSettingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(storeSettingsRef);

  const WHATSAPP_NUMBER = settings?.whatsappNumber || "917319965930";
  const HELP_LINE_NUMBER = settings?.helpLineNumber || "917319965930";
  const UPI_ID = settings?.upiId || "";
  const UPI_QR_URL = settings?.upiQrUrl || "";

  useEffect(() => {
    if (searchQuery.toLowerCase() === ADMIN_SECRET_KEY) {
      if (!user) setIsLoginDialogOpen(true);
      else setIsVerificationDialogOpen(true);
      setSearchQuery('');
    }
  }, [searchQuery, user]);

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === ADMIN_VERIFICATION_CODE) {
      if (user) {
        const adminRef = doc(firestore, 'admin_roles', user.uid);
        setDocumentNonBlocking(adminRef, { assignedAt: new Date().toISOString() }, { merge: true });
        setIsSecretAdminUnlocked(true);
        setIsVerificationDialogOpen(false);
        setVerificationCode('');
        toast({ title: "Admin Access Granted" });
      }
    } else {
      toast({ title: "Invalid Code", variant: "destructive" });
    }
  };

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);

  const themeDocRef = useMemoFirebase(() => doc(firestore, 'publicDisplaySettings', 'theme'), [firestore]);
  const { data: themeData } = useDoc(themeDocRef);
  const currentTheme: FestivalTheme = (themeData?.activeThemeName as FestivalTheme) || 'Normal';
  const currentThemeConfig = THEME_DATA[currentTheme];

  const adminRoleRef = useMemoFirebase(() => user ? doc(firestore, 'admin_roles', user.uid) : null, [firestore, user]);
  const { data: adminRole } = useDoc(adminRoleRef);
  const isAdmin = !!adminRole;

  const filteredProductsBySection = useMemo(() => {
    if (!products) return {};
    const sorted = [...products].sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
    const filtered = sorted.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered.reduce((acc: any, product: any) => {
      const section = product.section || "General Bazaar";
      if (!acc[section]) acc[section] = [];
      acc[section].push(product);
      return acc;
    }, {});
  }, [products, searchQuery]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) return toast({ title: "Invalid Number" });
    
    if (user) {
      setDocumentNonBlocking(doc(firestore, 'userProfiles', user.uid), { phoneNumber }, { merge: true });
      setIsPhoneDialogOpen(false);
      toast({ title: "Number Saved", description: "You can now proceed with your order." });
      if (selectedProduct) {
        setIsPaymentDialogOpen(true);
      }
    }
  };

  const handleBuyRequest = (product: any) => {
    setSelectedProduct(product);
    if (!user || !profile?.phoneNumber) {
      setIsPhoneDialogOpen(true);
      return;
    }
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentChoice = (method: 'COD' | 'UPI') => {
    if (method === 'UPI' && UPI_QR_URL) {
      setIsQrDialogOpen(true);
    } else {
      setIsPaymentDialogOpen(false);
      finalizeOrder(selectedProduct, method);
    }
  };

  const finalizeOrder = async (product: any, method: 'COD' | 'UPI') => {
    const phone = profile?.phoneNumber || phoneNumber;
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const locLink = `https://www.google.com/maps?q=${lat},${lng}`;
        
        const message = `*Bounsi Bazaar Order Alert!*\n\nItem: ${product.name}\nPrice: ₹${product.price}\nUnit: ${product.unit}\nPayment: ${method === 'UPI' ? 'Pay Now (UPI)' : 'Cash on Delivery'}\n\nDelivery Speed: 45 Minutes Max ⚡\nLocation: ${locLink}\n\nPhone: ${phone}`;
        
        // Save order to Firestore
        addDocumentNonBlocking(collection(firestore, 'orders'), {
          phoneNumber: phone,
          productId: product.id,
          productName: product.name,
          amount: product.price,
          status: 'pending',
          userId: user?.uid,
          createdAt: new Date().toISOString()
        });

        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
        
        setSelectedProduct(null);
        setIsQrDialogOpen(false);
        setIsPaymentDialogOpen(false);
        toast({ title: "Order Sent!", description: "Check your WhatsApp to confirm." });
      },
      () => {
        // Fallback without location if denied
        const message = `*Bounsi Bazaar Order Alert!*\n\nItem: ${product.name}\nPrice: ₹${product.price}\nUnit: ${product.unit}\nPayment: ${method === 'UPI' ? 'Pay Now (UPI)' : 'Cash on Delivery'}\n\nDelivery Speed: 45 Minutes Max ⚡\nPhone: ${phone}\n\n(Customer denied location sharing)`;
        
        addDocumentNonBlocking(collection(firestore, 'orders'), {
          phoneNumber: phone,
          productId: product.id,
          productName: product.name,
          amount: product.price,
          status: 'pending',
          userId: user?.uid,
          createdAt: new Date().toISOString()
        });

        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
        
        setSelectedProduct(null);
        setIsQrDialogOpen(false);
        setIsPaymentDialogOpen(false);
        toast({ title: "Order Sent!", description: "Check your WhatsApp to confirm." });
      }
    );
  };

  if (isProductsLoading || isUserLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className={cn("min-h-screen relative pb-20 overflow-x-hidden", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <nav className={cn("sticky top-0 z-50 py-4 glass-nav transition-all duration-1000", currentTheme === 'Normal' ? 'bg-primary' : '')}>
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-8 h-8 text-white animate-bounce" />
            <h1 className={cn("text-3xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r", currentThemeConfig.gradient)}>
              {currentThemeConfig.title}
            </h1>
          </div>
          
          <div className="relative w-full md:w-1/2 group">
            <Input placeholder="Search Bazaar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-14 pl-14 rounded-full text-black bg-white/95 shadow-2xl text-lg" />
            <Search className="absolute left-5 top-4.5 text-gray-400 w-6 h-6" />
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-yellow-400 text-black px-4 py-2 rounded-full flex items-center gap-2 font-black text-xs shadow-lg animate-pulse">
              <Clock className="w-4 h-4" /> 45MIN DELIVERY
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => window.open(`tel:${HELP_LINE_NUMBER}`)} className="rounded-full h-12 w-12 text-white bg-white/10 backdrop-blur-md">
              <PhoneCall className="w-6 h-6" />
            </Button>
            {(isAdmin || isSecretAdminUnlocked) && (
              <Button variant="ghost" size="icon" onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)} className="rounded-full h-14 w-14 text-white bg-white/10 backdrop-blur-md shadow-xl">
                <ShieldCheck className="w-8 h-8" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {(isAdmin || isSecretAdminUnlocked) && isAdminPanelVisible && (
        <div className="bg-white/5 backdrop-blur-2xl py-10 border-b border-white/10">
          <div className="container mx-auto px-4 mb-8 flex justify-between items-center text-white">
            <h2 className="text-3xl font-black flex items-center gap-3">ADMIN HUB</h2>
            <Button variant="outline" size="lg" onClick={async () => { await signOut(auth); setIsAdminPanelVisible(false); }} className="rounded-full bg-white/10 text-white border-white/20">
              <LogOut className="w-5 h-5 mr-2" /> Logout
            </Button>
          </div>
          <AdminPanel stats={{orders: 0, earnings: 0}} currentTheme={currentTheme} onResetStats={() => {}} />
        </div>
      )}

      <main className="container mx-auto p-4 md:p-8 mt-8">
        <div className="space-y-20">
          {Object.entries(filteredProductsBySection).map(([sectionName, items]: [string, any]) => (
            <section key={sectionName} className="space-y-8">
              <div className="flex items-center gap-4">
                <div className={cn("p-4 rounded-3xl shadow-xl bg-gradient-to-br", currentThemeConfig.gradient)}><LayoutGrid className="w-6 h-6 text-white" /></div>
                <h2 className={cn("text-4xl font-black uppercase tracking-tighter festive-title bg-gradient-to-r", currentThemeConfig.gradient)}>{sectionName}</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {items.map((p: any) => (
                  <div key={p.id} className="group product-card-premium rounded-[3rem] p-6 relative flex flex-col justify-between border border-white/20 shadow-xl bg-white/90">
                    <div className="relative overflow-hidden rounded-[2.5rem] h-60 mb-6 bg-slate-100">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute top-4 left-4 flex flex-col gap-2">
                        {p.isPinned && <Badge className="bg-yellow-400 text-black px-3 py-1 rounded-full text-[10px] font-black"><Pin className="w-3 h-3 mr-1" /> PINNED</Badge>}
                        <div className="flex gap-1">
                          {p.isCodAvailable && <Badge variant="secondary" className="bg-green-100 text-green-700 text-[8px] font-bold">COD</Badge>}
                          {p.isUpiAvailable && <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[8px] font-bold">UPI</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="px-2 mb-6">
                      <h3 className="font-black text-xl uppercase tracking-tighter mb-2">{p.name}</h3>
                      <p className={cn("text-3xl font-black italic", currentThemeConfig.accent)}>₹{p.price} <span className="text-sm text-gray-400 uppercase">/ {p.unit}</span></p>
                    </div>
                    <Button onClick={() => handleBuyRequest(p)} className={cn("w-full h-16 rounded-[1.5rem] font-black text-lg uppercase shadow-2xl text-white border-none", currentThemeConfig.gradient)}>
                      ORDER NOW <MessageCircle className="w-6 h-6 ml-2" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Phone Link Dialog */}
      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black flex items-center gap-3"><Phone className="w-8 h-8 text-primary" /> ENTER PHONE NUMBER</DialogTitle>
            <DialogDescription>Used for 45min delivery updates via WhatsApp.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePhoneSubmit} className="space-y-6 py-4">
            <Input type="tel" placeholder="Enter Mobile Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="h-16 text-2xl font-black rounded-2xl text-center" />
            <Button type="submit" className="w-full h-16 rounded-2xl text-xl font-black">START BAZAAR</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Selection Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black">CHOOSE PAYMENT</DialogTitle>
            <DialogDescription>Select how you want to pay for {selectedProduct?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-6">
            {selectedProduct?.isUpiAvailable && (
              <Button 
                onClick={() => handlePaymentChoice('UPI')}
                className="h-20 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-between px-8 text-xl font-black"
              >
                <div className="flex items-center gap-4">
                  <Smartphone className="w-8 h-8" />
                  PAY NOW (UPI)
                </div>
                <Wallet className="w-8 h-8 opacity-50" />
              </Button>
            )}
            {selectedProduct?.isCodAvailable && (
              <Button 
                onClick={() => handlePaymentChoice('COD')}
                variant="outline"
                className="h-20 rounded-2xl border-2 flex items-center justify-between px-8 text-xl font-black"
              >
                <div className="flex items-center gap-4">
                  <Banknote className="w-8 h-8 text-green-600" />
                  CASH ON DELIVERY
                </div>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* UPI QR Dialog */}
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-center">PAYMENT QR</DialogTitle>
            <DialogDescription className="text-center font-bold text-blue-600">{UPI_ID}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-4">
            {UPI_QR_URL ? (
              <img src={UPI_QR_URL} alt="Payment QR" className="w-64 h-64 object-contain rounded-2xl shadow-2xl border-8 border-white" />
            ) : (
              <div className="w-64 h-64 bg-slate-100 rounded-2xl flex items-center justify-center">
                <QrCode className="w-20 h-20 text-slate-300" />
              </div>
            )}
            <p className="text-center text-sm font-medium opacity-70">Scan this QR code using any UPI app like GPay, PhonePe, or Paytm to pay ₹{selectedProduct?.price}.</p>
            <Button onClick={() => finalizeOrder(selectedProduct, 'UPI')} className="w-full h-16 rounded-2xl text-xl font-black bg-blue-600 hover:bg-blue-700 text-white">I HAVE PAID</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10">
          <DialogHeader><DialogTitle className="text-3xl font-black">ADMIN ACCESS</DialogTitle></DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-8 py-6">
            <Input maxLength={4} placeholder="0000" className="text-center text-5xl h-24 tracking-[0.5em] font-black rounded-[2rem]" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
            <Button type="submit" className="w-full h-16 rounded-[1.5rem] text-xl font-black">UNLOCK BAZAAR</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10">
          <DialogHeader><DialogTitle className="text-3xl font-black">ADMIN LOGIN</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); isSignUp ? initiateEmailSignUp(auth, email, password) : initiateEmailSignIn(auth, email, password); setIsLoginDialogOpen(false); }} className="space-y-6 py-6">
            <Input type="email" value={email} placeholder="Email" onChange={(e) => setEmail(e.target.value)} className="h-14 rounded-2xl" />
            <Input type="password" value={password} placeholder="Password" onChange={(e) => setPassword(e.target.value)} className="h-14 rounded-2xl" />
            <Button type="submit" className="w-full h-16 rounded-[1.5rem] font-black">{isSignUp ? 'CREATE ACCOUNT' : 'SECURE SIGN IN'}</Button>
          </form>
          <Button variant="ghost" onClick={() => setIsSignUp(!isSignUp)} className="text-xs font-black uppercase underline">Toggle Sign Up</Button>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
