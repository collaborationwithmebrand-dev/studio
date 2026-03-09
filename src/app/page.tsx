
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, ShoppingBag, Loader2, LogOut, LayoutGrid, Clock, PhoneCall, MapPin, Package, Gift, Layers, ChevronRight, Smartphone, Banknote, QrCode, Pin, Plus, Minus, Trash2, ShoppingCart, User as UserIcon, History, XCircle, CheckCircle2 } from 'lucide-react';
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
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  initiateAnonymousSignIn,
  initiateEmailSignIn,
  initiateEmailSignUp
} from '@/firebase';
import { collection, doc, query, where, orderBy, limit } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const BOUNSI_LAT = 24.8021;
const BOUNSI_LNG = 87.0267;
const MAX_DISTANCE_KM = 9;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  imageUrl: string;
  quantity: number;
}

export default function Home() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(false);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isOrdersHistoryOpen, setIsOrdersHistoryOpen] = useState(false);
  
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [packagingType, setPackagingType] = useState<'Normal' | 'Gift'>('Normal');
  const [verificationCode, setVerificationCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationStatus, setLocationStatus] = useState<'checking' | 'allowed' | 'denied' | 'out_of_range'>('checking');

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

  const themeDocRef = useMemoFirebase(() => doc(firestore, 'publicDisplaySettings', 'theme'), [firestore]);
  const { data: themeData } = useDoc(themeDocRef);
  const currentTheme: FestivalTheme = (themeData?.activeThemeName as FestivalTheme) || 'Normal';
  const currentThemeConfig = THEME_DATA[currentTheme];

  const adminRoleRef = useMemoFirebase(() => user ? doc(firestore, 'admin_roles', user.uid) : null, [firestore, user]);
  const { data: adminRole } = useDoc(adminRoleRef);
  const isAdmin = !!adminRole;

  // We strictly filter by userId and limit to match security rules
  const userOrdersQuery = useMemoFirebase(() => {
    if (!user || isUserLoading) return null;
    return query(
      collection(firestore, 'orders'), 
      where('userId', '==', user.uid), 
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [firestore, user, isUserLoading]);
  const { data: userOrders } = useCollection(userOrdersQuery);

  useEffect(() => {
    if (searchQuery.toLowerCase() === ADMIN_SECRET_KEY) {
      setIsVerificationDialogOpen(true);
      setSearchQuery('');
    }
  }, [searchQuery]);

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === ADMIN_VERIFICATION_CODE && user) {
      setDocumentNonBlocking(doc(firestore, 'admin_roles', user.uid), { assignedAt: new Date().toISOString() }, { merge: true });
      setIsVerificationDialogOpen(false);
      setVerificationCode('');
      toast({ title: "Admin Access Granted" });
    } else {
      toast({ title: "Invalid Code", variant: "destructive" });
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) initiateEmailSignUp(auth, authEmail, authPassword);
    else initiateEmailSignIn(auth, authEmail, authPassword);
    setIsAuthDialogOpen(false);
    setAuthEmail('');
    setAuthPassword('');
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({ title: "Invalid Phone Number", variant: "destructive" });
      return;
    }
    if (user) {
      setDocumentNonBlocking(doc(firestore, 'userProfiles', user.uid), { phoneNumber, email: user.email || '' }, { merge: true });
      setIsPhoneDialogOpen(false);
      setIsPaymentDialogOpen(true);
      toast({ title: "Phone Verified" });
    }
  };

  const handleCancelOrder = (orderId: string) => {
    updateDocumentNonBlocking(doc(firestore, 'orders', orderId), { status: 'cancelled' });
    toast({ title: "Order Cancelled" });
  };

  const handleDeleteOrder = (orderId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'orders', orderId));
    toast({ title: "Order Removed from History" });
  };

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);

  const filteredProductsBySection = useMemo(() => {
    if (!products) return {};
    const filtered = products
      .filter(p => {
        const term = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(term) || 
          (p.section && p.section.toLowerCase().includes(term)) ||
          (p.category && p.category.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
    
    return filtered.reduce((acc: any, p: any) => {
      const s = p.section || "General Bazaar";
      if (!acc[s]) acc[s] = [];
      acc[s].push(p);
      return acc;
    }, {});
  }, [products, searchQuery]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          id: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit,
          imageUrl: product.imageUrl,
          quantity: existing ? Math.min(existing.quantity + 1, 10) : 1
        }
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev[productId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [productId]: { ...existing, quantity: existing.quantity - 1 }
      };
    });
  };

  const cartTotal = useMemo(() => {
    return Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const calculateFinalTotal = () => {
    const deliveryGST = cartTotal < 100 ? 125 : 25;
    const packagingFee = packagingType === 'Gift' ? 40 : 0;
    return cartTotal + deliveryGST + packagingFee;
  };

  const finalizeOrder = (method: 'COD' | 'UPI') => {
    const phone = profile?.phoneNumber || phoneNumber;
    const finalPrice = calculateFinalTotal();
    const itemsList = Object.values(cart).map(item => `• ${item.name} (${item.quantity} ${item.unit}) - ₹${item.price * item.quantity}`).join('\n');
    
    navigator.geolocation.getCurrentPosition((pos) => {
      const locLink = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      const message = `*BOUNSI BAZAAR ORDER*\n\n*Items:*\n${itemsList}\n\n*Total:* ₹${finalPrice}\n*Payment:* ${method}\n*Packaging:* ${packagingType}\n*Location:* ${locLink}\n*Phone:* ${phone}\n\n_Delivering in 30 mins!_ ⚡`;
      
      addDocumentNonBlocking(collection(firestore, 'orders'), {
        phoneNumber: phone,
        items: Object.values(cart),
        totalAmount: finalPrice,
        status: 'pending',
        userId: user?.uid,
        createdAt: new Date().toISOString()
      });

      window.open(`https://wa.me/${settings?.whatsappNumber || "917319965930"}?text=${encodeURIComponent(message)}`, '_blank');
      setIsQrDialogOpen(false);
      setIsPaymentDialogOpen(false);
      setCart({});
      toast({ title: "Order Placed Successfully!" });
    });
  };

  if (locationStatus === 'checking' || isProductsLoading || isUserLoading) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-green-500" />
      <p className="font-bold text-slate-400 text-xs tracking-widest uppercase">Opening Bounsi Bazaar...</p>
    </div>;
  }

  if (locationStatus === 'out_of_range' || locationStatus === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-8 text-center gap-6">
        <MapPin className="w-16 h-16 text-red-500" />
        <h1 className="text-3xl font-black text-slate-900 uppercase">Service Not Available</h1>
        <p className="text-slate-500 max-w-xs font-medium">We deliver within 9km of Bounsi (813104). Please enable location to browse the bazaar.</p>
        <Button onClick={() => window.location.reload()} size="lg" className="rounded-full px-10 h-14 bg-black text-white font-bold">RETRY</Button>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen relative pb-32 transition-colors duration-500", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <nav className="sticky top-0 z-50 glass-nav">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className={cn("text-xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r", currentThemeConfig.gradient)}>
              {currentThemeConfig.title}
            </h1>
          </div>
          
          <div className="relative flex-1 max-w-md hidden md:block">
            <Search className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
            <Input 
              placeholder="Search items..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full h-11 pl-10 rounded-xl bg-slate-50 border-none shadow-inner" 
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => user?.isAnonymous ? setIsAuthDialogOpen(true) : setIsOrdersHistoryOpen(true)} className="rounded-xl h-10 w-10">
              {user?.isAnonymous ? <UserIcon className="w-5 h-5 text-slate-600" /> : <History className="w-5 h-5 text-green-600" />}
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)} className="rounded-xl h-10 w-10 bg-blue-50">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {isAdmin && isAdminPanelVisible && (
        <div className="bg-white py-8 border-b animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="container mx-auto px-4 flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-blue-600 uppercase flex items-center gap-2">
              <Layers className="w-5 h-5" /> Admin Hub
            </h2>
            <Button variant="outline" size="sm" onClick={() => signOut(auth)} className="rounded-lg text-blue-600 border-blue-200">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
          <AdminPanel currentTheme={currentTheme} isAdmin={isAdmin} />
        </div>
      )}

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-12">
          {Object.entries(filteredProductsBySection).length > 0 ? (
            Object.entries(filteredProductsBySection).map(([section, items]: [string, any]) => (
              <section key={section} className="space-y-4">
                <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-green-500" /> {section}
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {items.map((p: any) => {
                    const cartItem = cart[p.id];
                    return (
                      <div key={p.id} className="group product-card-blinkit rounded-2xl p-3 flex flex-col h-full shadow-sm">
                        <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-slate-50">
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          {p.isPinned && (
                            <div className="absolute top-2 left-2 bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[8px] font-black flex items-center gap-1 shadow-sm">
                              <Pin className="w-2.5 h-2.5" /> PINNED
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <h3 className="font-bold text-xs text-slate-800 line-clamp-2 uppercase leading-tight">{p.name}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">
                            {p.unit === 'kg' || p.unit === 'Liter' ? `1 ${p.unit}` : p.unit}
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm font-black text-slate-900">₹{p.price}</span>
                          {cartItem ? (
                            <div className="flex items-center gap-2 bg-green-500 rounded-lg p-0.5 shadow-md shadow-green-100">
                              <Button onClick={() => removeFromCart(p.id)} size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-inner border-none">
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="text-white font-black text-xs w-4 text-center">{cartItem.quantity}</span>
                              <Button onClick={() => addToCart(p)} size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-inner border-none">
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button onClick={() => addToCart(p)} size="sm" className="rounded-lg h-8 px-4 font-black text-[10px] bg-green-500 text-white hover:bg-green-600 uppercase shadow-sm border-none">
                              ADD
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="py-20 text-center">
              <ShoppingBag className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold uppercase text-xs">No matching products found</p>
            </div>
          )}
        </div>
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-[60] animate-in slide-in-from-bottom-8 duration-500">
          <div className="bg-green-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-2xl border border-green-400">
            <div className="flex items-center gap-3">
              <div className="bg-green-700 p-2 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase leading-tight">{cartCount} ITEM{cartCount > 1 ? 'S' : ''}</p>
                <p className="text-lg font-black leading-tight">₹{cartTotal}</p>
              </div>
            </div>
            <Button onClick={() => {
              if (!user || user.isAnonymous) setIsAuthDialogOpen(true);
              else if (!profile?.phoneNumber) setIsPhoneDialogOpen(true);
              else setIsPaymentDialogOpen(true);
            }} className="bg-white text-green-700 hover:bg-slate-50 h-12 px-6 rounded-xl font-black uppercase text-xs flex items-center gap-2 border-none">
              VIEW CART <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Auth Dialog */}
      <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-sm text-center border-none shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black uppercase">{isSignUp ? 'Create Account' : 'Welcome Back'}</DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-slate-400">Save your orders and get faster delivery</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAuth} className="space-y-4">
            <Input type="email" placeholder="Email Address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="h-12 rounded-xl border-slate-100 bg-slate-50" required />
            <Input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="h-12 rounded-xl border-slate-100 bg-slate-50" required minLength={6} />
            <Button type="submit" className="w-full h-12 rounded-xl bg-green-500 text-white font-black uppercase border-none">
              {isSignUp ? 'Create Account' : 'Login'}
            </Button>
            <div className="pt-2">
              <p className="text-[10px] font-bold uppercase text-slate-400 cursor-pointer hover:text-green-600 transition-colors" onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? 'Already have an account? Login' : "Don't have an account? Create one"}
              </p>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Orders History Dialog */}
      <Dialog open={isOrdersHistoryOpen} onOpenChange={setIsOrdersHistoryOpen}>
        <DialogContent className="rounded-3xl p-6 max-md border-none shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
              <History className="w-5 h-5 text-green-600" /> My Orders
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {userOrders && userOrders.length > 0 ? (
              userOrders.map((order: any) => (
                <div key={order.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Order ID: #{order.id.slice(-6)}</p>
                      <p className="text-[10px] font-bold text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge className={cn(
                      "text-[9px] font-black uppercase rounded-lg border-none",
                      order.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                      order.status === 'confirmed' ? "bg-blue-100 text-blue-700" :
                      order.status === 'delivered' ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {order.items?.map((item: any, i: number) => (
                      <p key={i} className="text-[10px] font-bold text-slate-600 uppercase">
                        • {item.name} ({item.quantity} {item.unit})
                      </p>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200">
                    <span className="text-sm font-black text-slate-900">₹{order.totalAmount}</span>
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <Button onClick={() => handleCancelOrder(order.id)} size="sm" variant="outline" className="h-8 rounded-lg text-red-600 border-red-100 hover:bg-red-50 text-[9px] font-black uppercase">
                          <XCircle className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      )}
                      {(order.status === 'delivered' || order.status === 'cancelled') && (
                        <Button onClick={() => handleDeleteOrder(order.id)} size="sm" variant="ghost" className="h-8 rounded-lg text-slate-400 hover:text-red-500 text-[9px] font-black uppercase">
                          <Trash2 className="w-3 h-3" /> Delete History
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center space-y-2">
                <ShoppingBag className="w-12 h-12 text-slate-200 mx-auto" />
                <p className="text-[10px] font-black text-slate-400 uppercase">No orders yet</p>
              </div>
            )}
          </div>
          <Button onClick={() => signOut(auth)} variant="outline" className="w-full mt-4 h-11 rounded-xl border-slate-200 text-slate-400 font-black uppercase text-[10px]">
            <LogOut className="w-4 h-4 mr-2" /> Logout Account
          </Button>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-3xl p-6 max-sm border-none shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Checkout Summary</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-[200px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {Object.values(cart).map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <img src={item.imageUrl} className="w-10 h-10 rounded-lg object-cover" />
                    <div>
                      <p className="text-[10px] font-black uppercase line-clamp-1">{item.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{item.quantity} x {item.unit}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-slate-400">Choose Packaging</Label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPackagingType('Normal')} className={cn("p-3 rounded-xl border text-left transition-all", packagingType === 'Normal' ? "border-green-500 bg-green-50/50" : "border-slate-100")}>
                  <Package className={cn("w-4 h-4 mb-1", packagingType === 'Normal' ? "text-green-500" : "text-slate-300")} />
                  <p className="text-[10px] font-black uppercase">Standard (Free)</p>
                </button>
                <button onClick={() => setPackagingType('Gift')} className={cn("p-3 rounded-xl border text-left transition-all", packagingType === 'Gift' ? "border-pink-500 bg-pink-50/50" : "border-slate-100")}>
                  <Gift className={cn("w-4 h-4 mb-1", packagingType === 'Gift' ? "text-pink-500" : "text-slate-300")} />
                  <p className="text-[10px] font-black uppercase">Gift Box (+₹40)</p>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                <span>Items Subtotal</span>
                <span>₹{cartTotal}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                <span>Delivery & GST Fee</span>
                <span>₹{cartTotal < 100 ? 125 : 25}</span>
              </div>
              {packagingType === 'Gift' && (
                <div className="flex justify-between text-[10px] font-bold text-pink-500 uppercase">
                  <span>Gift Wrapping</span>
                  <span>₹40</span>
                </div>
              )}
              <div className="pt-2 border-t border-dashed border-slate-300 flex justify-between items-center">
                <span className="text-sm font-black uppercase">To Pay</span>
                <span className="text-lg font-black text-green-600">₹{calculateFinalTotal()}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button onClick={() => { if(settings?.upiQrUrl) setIsQrDialogOpen(true); else finalizeOrder('UPI'); }} className="h-12 rounded-xl bg-green-500 text-white font-black text-xs uppercase shadow-lg shadow-green-100 border-none">
                <Smartphone className="w-4 h-4 mr-2" /> Pay via UPI
              </Button>
              <Button onClick={() => finalizeOrder('COD')} variant="outline" className="h-12 rounded-xl border-slate-200 text-slate-600 font-black text-xs uppercase">
                <Banknote className="w-4 h-4 mr-2" /> Cash on Delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-3xl p-8 max-xs text-center border-none shadow-2xl">
          <h3 className="text-lg font-black uppercase mb-4">Scan QR to Pay</h3>
          <div className="p-4 bg-white rounded-2xl border-4 border-slate-50 shadow-inner mb-4">
            {settings?.upiQrUrl ? <img src={settings.upiQrUrl} className="w-48 h-48 mx-auto object-contain" /> : <div className="w-48 h-48 bg-slate-100 flex items-center justify-center"><QrCode className="w-10 h-10 text-slate-300" /></div>}
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-6">UPI ID: {settings?.upiId || "No UPI ID set"}</p>
          <Button onClick={() => finalizeOrder('UPI')} className="w-full h-12 rounded-xl bg-black text-white font-black uppercase text-xs border-none">I Have Completed Payment</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-sm text-center border-none shadow-2xl">
          <DialogHeader className="mb-4"><DialogTitle className="text-xl font-black uppercase">Verify Phone</DialogTitle></DialogHeader>
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <Input 
              type="tel" 
              placeholder="Mobile Number" 
              value={phoneNumber} 
              onChange={(e) => setPhoneNumber(e.target.value)} 
              className="h-12 text-center text-lg font-bold rounded-xl border-slate-100 bg-slate-50" 
            />
            <Button type="submit" className="w-full h-12 rounded-xl bg-green-500 text-white font-black uppercase border-none">Continue</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-xs text-center border-none shadow-2xl">
          <DialogHeader><DialogTitle className="text-lg font-black uppercase">Admin Verification</DialogTitle></DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-4 pt-2">
            <Input 
              maxLength={4} 
              className="text-center text-3xl h-16 font-black rounded-xl border-slate-100 bg-slate-50" 
              value={verificationCode} 
              onChange={(e) => setVerificationCode(e.target.value)} 
            />
            <Button type="submit" className="w-full h-12 rounded-xl bg-blue-600 text-white font-black uppercase border-none">Verify & Unlock</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
