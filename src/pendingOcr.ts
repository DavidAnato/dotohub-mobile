export type IdOcr = {
  npi?: string;
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  birth_place?: string | null;
  phone?: string | null;
  address_commune?: string | null;
  address_arrondissement?: string | null;
  address_quartier?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  card_type?: string | null;
};

let pending: IdOcr | null = null;

export function setPendingOcr(value: IdOcr | null) {
  pending = value;
}

export function takePendingOcr(): IdOcr | null {
  const value = pending;
  pending = null;
  return value;
}
