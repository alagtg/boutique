import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Product, CreateOrder } from '../../../services/api.service';

function normPhone(raw: string): string {
  let p = (raw||'').replace(/\D+/g,'');
  if (p.length === 8) p = '216' + p;            // tunisien nu -> 216 + 8
  if (p.startsWith('00216')) p = p.replace(/^00/, '');
  return p;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-detail.component.html'
})
export class ProductDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  product?: Product;
  size='M'; color='Beige'; qty=1;
  name=''; phone=''; address=''; note='';
  msg=''; msgType: 'success'|'error'|'' = '';
  triedSubmit = false;

  encodeURIComponent = encodeURIComponent;

  ngOnInit(){
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.getProduct(id).subscribe(p=> this.product=p);
  }

  whatsappHref(): string {
    if (!this.product) return '';
    const txt = `Bonjour, je veux ${this.product.name} (${this.size}, ${this.color}) x${this.qty}
Nom: ${this.name}
Téléphone: ${this.phone}
Adresse: ${this.address}
Note: ${this.note||''}`;
    return 'https://wa.me/21650878068?text=' + encodeURIComponent(txt);
  }

  buy(form: NgForm){
    this.triedSubmit = true;
    if (!form.valid || !this.product || this.qty<1 || this.qty>this.product.stock) {
      this.msgType = 'error';
      this.msg = '❌ Merci de compléter correctement tous les champs (quantité ≤ stock).';
      return;
    }

    const phoneN = normPhone(this.phone);
    if (!phoneN || (phoneN.length < 11 || phoneN.length > 13)) {
      this.msgType = 'error';
      this.msg = '❌ Téléphone invalide.';
      return;
    }

    const order: CreateOrder = {
      customerName: this.name.trim(),
      phone: phoneN,
      address: this.address.trim(),
      note: this.note,
      items: [{
        productId: this.product.id,
        size: this.size,
        color: this.color,
        quantity: this.qty,
        unitPrice: this.product.price
      }]
    };

    this.api.createOrder(order).subscribe({
      next: ()=>{
        this.msgType = 'success';
        this.msg = '✅ Commande envoyée ! Nous vous contacterons pour confirmer.';
        this.triedSubmit = false;
      },
      error: ()=>{
        this.msgType = 'error';
        this.msg = '❌ Erreur lors de l’envoi de la commande.';
      }
    });
  }
}
