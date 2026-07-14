import { updateClient } from './src/app/actions/clientActions';
import * as dotenv from 'dotenv';
dotenv.config({path: '.env'});
process.env.DATABASE_URL = "postgresql://postgres:SpEnergia2026%21@localhost:5432/sperp_local";

async function run() {
  const data = {
    businessName: "",
    firstName: "LORENA",
    lastName: "DE DIOS",
    lastName2: "QUESADA",
    vatNumber: "26826868J",
    contactEmail: "lorenadediosquesada@icloud.com",
    contactPhone: "643121641",
    billingStreetType: "",
    billingStreet: "HORNO",
    billingNumber: "20",
    billingFloor: "",
    billingDoor: "",
    billingPostalCode: "14850",
    billingCity: "BAENA",
    billingProvince: "Córdoba"
  };
  
  try {
    const res = await updateClient("cmq6yqdbn0ee7ic41x1cwpakz", data);
    console.log(res);
  } catch (err) {
    console.error(err);
  }
}
run();
