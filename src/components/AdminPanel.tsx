
"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FestivalTheme } from '@/app/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';

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

  const handleAdd = async () => {
    if (!name || !price || !imageUrl) return toast({ title: "Error", variant: "destructive" });
    addDocumentNonBlocking(collection(firestore, 'products'), {
      name, 
      price: parseFloat(price), 
      unit, 
      section, 
      category, 
      imageUrl, 
      isCodAvailable, 
      isUpiAvailable, 
      isPinned, 
      createdAt: new Date().toISOString()
    });
    setName(''); 
    setPrice(''); 
    setImageUrl('');
    toast({ title: "Success", description: "Product added to Bazaar!" });
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Add Section */}
        <Card className="rounded-[2.5rem] shadow-2xl border-none lg:col-span-2">
          <CardHeader><CardTitle className="text-primary font-black">ADD NEW ITEM</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Product Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium Kaju Katli" className="rounded-xl h-12" />
              </div>
              <div className="space-y-1">
                <Label>Price (₹)</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price in Rupees" className="rounded-xl h-12" />
              </div>
              <div className="space-y-1">
                <Label>Store Section</Label>
                <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Sweets Corner" className="rounded-xl h-12" />
              </div>
              <div className="space-y-1">
                <Label>Image URL</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="rounded-xl h-12" />
              </div>
              <div className="space-y-1">
                <Label>Unit Type</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gm">gm</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="Liter">Liter</SelectItem>
                    <SelectItem value="Pcs">Pcs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Food">Food</SelectItem>
                    <SelectItem value="Festive">Festive</SelectItem>
                    <SelectItem value="Fashion">Fashion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-6 py-4">
              <div className="flex items-center gap-3">
                <Checkbox id="cod" checked={isCodAvailable} onCheckedChange={(v) => setIsCodAvailable(v === true)} />
                <Label htmlFor="cod" className="cursor-pointer">Enable COD</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="upi" checked={isUpiAvailable} onCheckedChange={(v) => setIsUpiAvailable(v === true)} />
                <Label htmlFor="upi" className="cursor-pointer">Enable UPI Pay</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="pin" checked={isPinned} onCheckedChange={(v) => setIsPinned(v === true)} />
                <Label htmlFor="pin" className="cursor-pointer font-bold text-primary">Pin to Top</Label>
              </div>
            </div>

            <Button onClick={handleAdd} className="w-full h-16 rounded-2xl font-black text-xl shadow-lg">
              ADD TO BAZAAR STORE
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
