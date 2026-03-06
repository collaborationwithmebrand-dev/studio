"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, ShoppingBag, Loader2, LogOut, LayoutGrid, Clock, PhoneCall, MapPin, Package, Gift, Layers, ChevronRight, Smartphone, Banknote, QrCode, Pin } from 'lucide-react';
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
import { collection, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Bounsi, Bihar (813104) Center Coordinates
const BOUNSI_LAT = 24.8021;
const BOUNSI_LNG = 87.0267;
const MAX_DISTANCE_KM = 9;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function Home() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(false);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [packagingType, setPackagingType] = useState<'Normal' | 'Gift'>('Normal');
  const [quantity, setQuantity] = useState<number>(1);
  const [verificationCode, setVerificationCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationStatus, setLocationStatus] = useState<'checking' | 'allowed' | 'denied' | 'out_of_range'>('checking');
  const [userDistance, setUserDistance] = useState<number | null>(null);

  const ADMIN_SECRET_KEY = 'kela123';
  const ADMIN_VERIFICATION_CODE = '5930'; 

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = calculateDistance(BOUNSI_LAT, BOUNSI_LNG, pos.coords.latitude, pos.coords.longitude);
        setUserDistance(dist);
        if (dist <= MAX_DISTANCE_KM) setLocationStatus('allowed');
        else setLocationStatus('out_of_range');
      },
      () => setLocationStatus('denied')
    );
  }, []);

  useEffect(() => {
    if (!isUserLoading && !user) initiateAnonymousSignIn(auth);
  }, [user, isUserLoading, auth]);

  const profileRef = useMemoFirebase(() => user ? doc(firestore, 'userProfiles', user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(profileRef);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const WHATSAPP_NUMBER = settings?.whatsappNumber || "917319965930";
  const HELP_LINE_NUMBER = settings?.helpLineNumber || "917319965930";
  const UPI_ID = settings?.upiId || "";
  const UPI_QR_URL = settings?.upiQrUrl || "";

  useEffect(() => {
    if (searchQuery.toLowerCase() === ADMIN_SECRET_KEY) {
      setIsVerificationDialogOpen(true);
      setSearchQuery('');
    }
  }, [searchQuery]);

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === ADMIN_VERIFICATION_CODE) {
      if (user) {
        setDocumentNonBlocking(doc(firestore, 'admin_roles', user.uid), { assignedAt: new Date().toISOString() }, { merge: true });
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
    const filtered = products
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
    return filtered.reduce((acc: any, product: any) => {
      const section = product.section || "General Bazaar";
      if (!acc[section]) acc[section] = [];
      acc[section].push(product);
      return acc;
    }, {});
  }, [products, searchQuery]);

  const calculateTotalPrice = (basePrice: number, qty: number = 1) => {
    const subtotal = basePrice * qty;
    const deliveryGST = subtotal < 100 ? 125 : 25;
    const packagingFee = packagingType === 'Gift' ? 40 : 0;
    return subtotal + deliveryGST + packagingFee;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) return toast({ title: "Invalid Number" });
    if (user) {
      setDocumentNonBlocking(doc(firestore, 'userProfiles', user.uid), { phoneNumber }, { merge: true });
      setIsPhoneDialogOpen(false);
      if (selectedProduct) setIsPaymentDialogOpen(true);
    }
  };

  const handleBuyRequest = (product: any) => {
    setSelectedProduct(product);
    setQuantity(1);
    setPackagingType('Normal');
    if (!user || !profile?.phoneNumber) {
      setIsPhoneDialogOpen(true);
      return;
    }
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentChoice = (method: 'COD' | 'UPI') => {
    if (method === 'UPI' && UPI_QR_URL) setIsQrDialogOpen(true);
    else finalizeOrder(selectedProduct, method);
  };

  const finalizeOrder = async (product: any, method: 'COD' | 'UPI') => {
    const phone = profile?.phoneNumber || phoneNumber;
    const finalPrice = calculateTotalPrice(product.price, quantity);
    const packagingInfo = packagingType === 'Gift' ? "Gift Box (+₹40)" : "Standard (Free)";
    
    navigator.geolocation.getCurrentPosition((pos) => {
      const locLink = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      const message = `*BOUNSI BAZAAR ORDER*\n\n*Item:* ${product.name}\n*Qty:* ${quantity} ${product.unit}\n*Total:* ₹${finalPrice}\n*Payment:* ${method}\n*Packaging:* ${packagingInfo}\n*Location:* ${locLink}\n*Phone:* ${phone}\n\n_Delivering in 30 mins!_ ⚡`;
      
      addDocumentNonBlocking(collection(firestore, 'orders'), {
        phoneNumber: phone,
        productName: product.name,
        quantity,
        amount: finalPrice,
        status: 'pending',
        userId: user?.uid,
        createdAt: new Date().toISOString()
      });

      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
      setIsQrDialogOpen(false);
      setIsPaymentDialogOpen(false);
    });
  };

  if (locationStatus === 'checking' || isProductsLoading || isUserLoading) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <p className="font-bold text-slate-400 uppercase tracking-tighter">Locating Bounsi Bazaar...</p>
    </div>;
  }

  if (locationStatus === 'out_of_range' || locationStatus === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-10 text-center space-y-6">
        <MapPin className="w-20 h-20 text-red-500" />
        <h1 className="text-4xl font-black text-slate-900 uppercase">Service Unavailable</h1>
        <p className="text-xl text-slate-500 max-w-md font-medium">
          {locationStatus === 'denied' 
            ? "Enable location to shop. We deliver within 9km of Bounsi (813104)."
            : `You are ${userDistance?.toFixed(1)}km away. Our limit is 9km from Bounsi.`}
        </p>
        <Button onClick={() => window.location.reload()} size="lg" className="rounded-full px-12 h-16 text-xl font-bold">RETRY</Button>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen relative pb-24 transition-colors duration-1000", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <nav className="sticky top-0 z-50 py-3 glass-nav">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-primary animate-pulse" />
            <h1 className={cn("text-2xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r transition-all duration-1000", currentThemeConfig.gradient)}>
              {currentThemeConfig.title}
            </h1>
          </div>
          
          <div className="relative w-full md:w-1/3">
            <Input placeholder="Search milk, ghee, groceries..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-12 pl-12 rounded-2xl bg-slate-50 border-none shadow-inner" />
            <Search className="absolute left-4 top-3.5 text-slate-400 w-5 h-5" />
          </div>

          <div className="flex items-center gap-3">
            <Badge className="bg-green-100 text-green-700 px-3 py-1.5 rounded-xl border-none font-black text-[10px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> 30 MIN DELIVERY
            </Badge>
            <Button variant="outline" size="icon" onClick={() => window.open(`tel:${HELP_LINE_NUMBER}`)} className="rounded-2xl h-11 w-11 border-slate-200">
              <PhoneCall className="w-5 h-5 text-slate-600" />
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)} className="rounded-2xl h-11 w-11 bg-blue-50">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {isAdmin && isAdminPanelVisible && (
        <div className="bg-white py-12 border-b animate-in slide-in-from-top duration-500">
          <div className="container mx-auto px-4 flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-blue-600 uppercase flex items-center gap-2">
              <Layers className="w-6 h-6" /> Admin Hub
            </h2>
            <Button variant="outline" size="sm" onClick={() => signOut(auth)} className="rounded-xl text-blue-600 border-blue-200">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
          <AdminPanel stats={{orders: 0, earnings: 0}} currentTheme={currentTheme} onResetStats={() => {}} />
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-16">
          {Object.entries(filteredProductsBySection).map(([section, items]: [string, any]) => (
            <section key={section} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                  <LayoutGrid className="w-6 h-6 text-primary" /> {section}
                </h2>
                <Badge variant="outline" className="rounded-full px-4 border-slate-200 text-slate-400 font-bold uppercase text-[9px]">
                  {items.length} Items
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {items.map((p: any) => (
                  <div key={p.id} className="group product-card-premium rounded-[2rem] p-4 flex flex-col h-full shadow-sm hover:shadow-xl">
                    <div className="relative aspect-square mb-4 rounded-[1.5rem] overflow-hidden bg-slate-50">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      {p.isPinned && (
                        <div className="absolute top-3 left-3 bg-yellow-400 text-black px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 shadow-md">
                          <Pin className="w-3 h-3" /> FEATURED
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1 px-1">
                      <h3 className="font-bold text-sm text-slate-800 line-clamp-2 uppercase">{p.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{p.unit === 'kg' || p.unit === 'Liter' ? `Per ${p.unit}` : p.unit}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between px-1">
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-slate-900">₹{p.price}</span>
                        {p.price < 100 && <span className="text-[8px] font-bold text-red-500 uppercase">+GST/Deliv</span>}
                      </div>
                      <Button onClick={() => handleBuyRequest(p)} size="sm" className="rounded-xl px-4 font-black text-[10px] bg-slate-900 text-white hover:bg-primary transition-colors uppercase">
                        ADD
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden max-w-md border-none">
          <div className="p-8 space-y-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Bill Summary</DialogTitle>
              <DialogDescription className="font-bold text-slate-400 text-[10px] uppercase">Review and pay to order</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {(selectedProduct?.unit === 'kg' || selectedProduct?.unit === 'Liter') && (
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Select Quantity</Label>
                  <Select value={quantity.toString()} onValueChange={(v) => setQuantity(parseInt(v))}>
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {[1,2,3,4,5].map(n => <SelectItem key={n} value={n.toString()} className="font-bold">{n} {selectedProduct.unit}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" /> Packaging Preference</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPackagingType('Normal')} className={cn("p-4 rounded-2xl border-2 text-left transition-all", packagingType === 'Normal' ? "border-primary bg-primary/5" : "border-slate-100")}>
                    <Package className={cn("w-5 h-5 mb-2", packagingType === 'Normal' ? "text-primary" : "text-slate-300")} />
                    <p className="text-xs font-black uppercase">Standard</p>
                    <p className="text-[9px] font-bold text-slate-400">FREE</p>
                  </button>
                  <button onClick={() => setPackagingType('Gift')} className={cn("p-4 rounded-2xl border-2 text-left transition-all", packagingType === 'Gift' ? "border-pink-500 bg-pink-50" : "border-slate-100")}>
                    <Gift className={cn("w-5 h-5 mb-2", packagingType === 'Gift' ? "text-pink-500" : "text-slate-300")} />
                    <p className="text-xs font-black uppercase">Gift Box</p>
                    <p className="text-[9px] font-bold text-pink-500">+₹40</p>
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 space-y-3">
                <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase">
                  <span>Item Total ({quantity})</span>
                  <span>₹{selectedProduct?.price * quantity}</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase">
                  <span>Delivery & GST Fee</span>
                  <span>₹{(selectedProduct?.price * quantity) < 100 ? 125 : 25}</span>
                </div>
                {packagingType === 'Gift' && (
                  <div className="flex justify-between text-[11px] font-bold text-pink-500 uppercase">
                    <span>Packaging Charge</span>
                    <span>₹40</span>
                  </div>
                )}
                <div className="pt-3 border-t-2 border-dashed border-slate-200 flex justify-between items-center">
                  <span className="text-lg font-black uppercase">Total Pay</span>
                  <span className="text-xl font-black text-primary">₹{calculateTotalPrice(selectedProduct?.price || 0, quantity)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-white border-t flex flex-col gap-2">
            <Button onClick={() => handlePaymentChoice('UPI')} className="h-14 rounded-xl bg-primary text-white font-black text-sm uppercase flex justify-between px-6 shadow-lg shadow-primary/20">
              <span className="flex items-center gap-2"><Smartphone className="w-5 h-5" /> Pay Now (UPI)</span>
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={() => handlePaymentChoice('COD')} variant="outline" className="h-14 rounded-xl border-slate-200 text-slate-600 font-black text-sm uppercase flex justify-between px-6">
              <span className="flex items-center gap-2"><Banknote className="w-5 h-5" /> Cash on Delivery</span>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 max-w-sm">
          <div className="flex flex-col items-center gap-6 text-center">
            <h3 className="text-xl font-black uppercase">Scan to Pay</h3>
            <div className="relative p-4 bg-white rounded-3xl shadow-2xl border-8 border-slate-50">
              {UPI_QR_URL ? (
                <img src={UPI_QR_URL} alt="QR" className="w-56 h-56 object-contain" />
              ) : (
                <div className="w-56 h-56 bg-slate-100 flex items-center justify-center"><QrCode className="w-16 h-16 text-slate-300" /></div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-black text-primary">{UPI_ID}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Pay ₹{calculateTotalPrice(selectedProduct?.price || 0, quantity)} to confirm</p>
            </div>
            <Button onClick={() => finalizeOrder(selectedProduct, 'UPI')} className="w-full h-14 rounded-xl bg-slate-900 text-white font-black uppercase">I Have Paid</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 max-w-sm text-center">
          <div className="space-y-6">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
              <Smartphone className="w-8 h-8 text-blue-600" />
            </div>
            <DialogHeader><DialogTitle className="text-2xl font-black text-center uppercase">Login to Bazaar</DialogTitle></DialogHeader>
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <Input type="tel" placeholder="10-digit Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="h-14 text-center text-xl font-black rounded-xl border-slate-100" />
              <Button type="submit" className="w-full h-14 rounded-xl bg-primary text-white font-black uppercase">Confirm Phone</Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 max-w-xs text-center">
          <DialogHeader><DialogTitle className="text-xl font-black uppercase">Admin Unlock</DialogTitle></DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-6 pt-4">
            <Input maxLength={4} className="text-center text-4xl h-20 font-black rounded-2xl border-blue-100" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
            <Button type="submit" className="w-full h-14 rounded-xl bg-blue-600 text-white font-black uppercase">Open Controls</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}