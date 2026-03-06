
"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FestivalTheme, THEME_DATA } from '@/app/lib/constants';
import { Sparkles, Plus, Trash2, ChartBar, Palette, PackagePlus, Scale, LayoutGrid, DatabaseBackup, CreditCard, Banknote, Pin, QrCode, Ticket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking, addDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';

interface AdminPanelProps {
  stats: { orders: number; earnings: number; upiId?: string; upiQrUrl?: string };
  currentTheme: FestivalTheme;
  onResetStats: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ stats, currentTheme }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Food');
  const [unit, setUnit] = useState('kg');
  const [section, setSection] = useState('General Bazaar');
  const [imageUrl, setImageUrl] = useState('');
  const [isCodAvailable, setIsCodAvailable] = useState(true);
  const [isUpiAvailable, setIsUpiAvailable] = useState(true);
  const [isPinned, setIsPinned] = useState(false);

  const couponsQuery = React.useMemo(() => collection(firestore, 'coupons'), [firestore]);
  const { data: coupons } = useCollection(couponsQuery);

  const generateCoupons = () => {
    const colRef = collection(firestore, 'coupons');
    for (let i = 1; i <= 50; i++) {
      const code = `BAZAAR50-${i.toString().padStart(2, '0')}`;
      addDocumentNonBlocking(colRef, { code, isUsed: false, createdAt: new Date().toISOString() });
    }
    toast({ title: "50 Coupons Generated", description: "Refresh to view them below." });
  };

  const handleAdd = async () => {
    if (!name || !price || !imageUrl) return toast({ title: "Error", variant: "destructive" });
    addDocumentNonBlocking(collection(firestore, 'products'), {
      name, price: parseFloat(price), unit, section, category, imageUrl, isCodAvailable, isUpiAvailable, isPinned, createdAt: new Date().toISOString()
    });
    setName(''); setPrice(''); setImageUrl('');
    toast({ title: "Success", description: "Product added to Bazaar!" });
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coupon Section */}
        <Card className="rounded-[2.5rem] shadow-2xl border-none">
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-primary font-black"><Ticket className="w-6 h-6" /> COUPON MANAGER</CardTitle>
            <Button onClick={generateCoupons} variant="outline" className="rounded-2xl border-dashed">Generate 50 Codes</Button>
          </CardHeader>
          <CardContent>
            <div className="h-64 overflow-y-auto grid grid-cols-2 gap-2 pr-2">
              {coupons?.map((c: any) => (
                <div key={c.id} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                  <span className="font-black text-xs font-mono">{c.code}</span>
                  {c.isUsed && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">USED</span>}
                </div>
              ))}
              {(!coupons || coupons.length === 0) && <p className="col-span-2 text-center text-gray-400 py-20 font-bold uppercase">No coupons generated</p>}
            </div>
          </CardContent>
        </Card>

        {/* Product Add Section */}
        <Card className="rounded-[2.5rem] shadow-2xl border-none">
          <CardHeader><CardTitle className="text-primary font-black">ADD NEW ITEM</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product Name" className="rounded-xl h-12" />
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (₹)" className="rounded-xl h-12" />
              <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section Name" className="rounded-xl h-12" />
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" className="rounded-xl h-12" />
              <Select value={unit} onValueChange={setUnit}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="gm">gm</SelectItem><SelectItem value="kg">kg</SelectItem><SelectItem value="Liter">Liter</SelectItem><SelectItem value="Pcs">Pcs</SelectItem></SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Food">Food</SelectItem><SelectItem value="Festive">Festive</SelectItem><SelectItem value="Fashion">Fashion</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex gap-4 py-2">
              <div className="flex items-center gap-2"><Checkbox checked={isCodAvailable} onCheckedChange={(v) => setIsCodAvailable(v === true)} /><Label>COD</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={isUpiAvailable} onCheckedChange={(v) => setIsUpiAvailable(v === true)} /><Label>UPI</Label></div>
              <div className="flex items-center gap-2"><Checkbox checked={isPinned} onCheckedChange={(v) => setIsPinned(v === true)} /><Label>PIN</Label></div>
            </div>
            <Button onClick={handleAdd} className="w-full h-14 rounded-2xl font-black">ADD TO STORE</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
