import urllib.request
import json
import time
import os

MAKES = [
    "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Bugatti", "Buick",
    "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Fisker", "Ford", "Genesis",
    "GMC", "Hennessey", "Honda", "Hummer", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Karma", "Kia",
    "Koenigsegg", "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus", "Lucid", "Maserati",
    "Maybach", "Mazda", "McLaren", "Mercedes-Benz", "Mercury", "Mini", "Mitsubishi", "Nissan",
    "Noble", "Oldsmobile", "Pagani", "Polestar", "Pontiac", "Porsche", "Ram", "Rimac", "Rivian", "Rolls-Royce",
    "Saab", "Saleen", "Saturn", "Scion", "Smart", "Spyker", "Subaru", "Suzuki", "Tesla", "Toyota",
    "VinFast", "Volkswagen", "Volvo"
]

FALLBACK_MODELS = {
    'Acura': ['ILX', 'Integra', 'MDX', 'NSX', 'RDX', 'RLX', 'TLX', 'ZDX', 'RSX', 'Legend', 'Vigor'],
    'Alfa Romeo': ['4C', 'Giulia', 'Stelvio', 'Tonale', 'Spider', 'GTV'],
    'Aston Martin': ['DB11', 'DB12', 'DBS', 'DBX', 'Vantage', 'Vanquish', 'Valhalla', 'DB9', 'DB7'],
    'Audi': ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'e-tron', 'e-tron GT', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'R8', 'RS e-tron GT', 'RS3', 'RS5', 'RS6', 'RS7', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'SQ5', 'SQ7', 'SQ8', 'TT', 'TT RS', 'Quattro'],
    'Bentley': ['Bentayga', 'Continental GT', 'Flying Spur', 'Mulsanne', 'Arnage'],
    'BMW': ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series', 'i3', 'i4', 'i7', 'iX', 'M2', 'M3', 'M4', 'M5', 'M8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'XM', 'Z4', 'Z3', '850i', 'M5 E39', 'M3 E30', 'M3 E46', 'M3 E92'],
    'Bugatti': ['Chiron', 'Veyron', 'Divo', 'Mistral', 'EB110'],
    'Buick': ['Enclave', 'Encore', 'Encore GX', 'Envision', 'Envista', 'LaCrosse', 'Regal', 'Grand National', 'GNX', 'Roadmaster'],
    'Cadillac': ['CT4', 'CT5', 'CTS', 'Escalade', 'Escalade ESV', 'Lyriq', 'XT4', 'XT5', 'XT6', 'XTS', 'Eldorado', 'DeVille', 'Fleetwood'],
    'Chevrolet': ['Blazer', 'Bolt EV', 'Bolt EUV', 'Camaro', 'Colorado', 'Corvette', 'Cruze', 'Equinox', 'Express', 'Impala', 'Malibu', 'Silverado 1500', 'Silverado 2500 HD', 'Silverado 3500 HD', 'Spark', 'Suburban', 'Tahoe', 'Trailblazer', 'Traverse', 'Trax', 'Volt', 'El Camino', 'Chevelle', 'Nova', 'Corvette C8', 'Corvette C7', 'Corvette C6', 'Corvette C5', 'Corvette ZR1', 'Bel Air', 'K5 Blazer'],
    'Chrysler': ['300', 'Pacifica', 'Voyager', 'Crossfire', 'Prowler'],
    'Dodge': ['Challenger', 'Charger', 'Durango', 'Grand Caravan', 'Hornet', 'Journey', 'Viper', 'Stealth', 'Ram SRT-10', 'Neon SRT-4'],
    'Ferrari': ['296', '458', '488', '812', 'California', 'F12', 'F8', 'GTC4Lusso', 'LaFerrari', 'Portofino', 'Purosangue', 'Roma', 'SF90', 'Stradale', 'Enzo', 'F40', 'F50', 'Testarossa', '360 Modena', 'F430', '599 GTB'],
    'Fiat': ['124 Spider', '500', '500e', '500L', '500X', 'Barchetta'],
    'Fisker': ['Ocean'],
    'Ford': ['Bronco', 'Bronco Sport', 'Bronco Raptor', 'EcoSport', 'Edge', 'Escape', 'Expedition', 'Expedition Max', 'Explorer', 'F-150', 'F-150 Lightning', 'F-150 Raptor', 'F-250 Super Duty', 'F-350 Super Duty', 'F-450 Super Duty', 'Fiesta', 'Flex', 'Focus', 'Fusion', 'Maverick', 'Mustang', 'Mustang Mach-E', 'Ranger', 'Ranger Raptor', 'Raptor', 'Shelby GT500', 'Taurus', 'Transit', 'Transit Connect', 'Ford GT', 'Escort RS Cosworth', 'Sierra Cosworth', 'RS200', 'Falcon', 'Shelby GT350'],
    'Genesis': ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
    'GMC': ['Acadia', 'Canyon', 'Hummer EV', 'Savana', 'Sierra 1500', 'Sierra 2500 HD', 'Sierra 3500 HD', 'Terrain', 'Yukon', 'Yukon XL', 'Syclone', 'Typhoon'],
    'Hennessey': ['Venom GT', 'Venom F5'],
    'Honda': ['Accord', 'Civic', 'Clarity', 'CR-V', 'Fit', 'HR-V', 'Insight', 'Odyssey', 'Passport', 'Pilot', 'Prologue', 'Ridgeline', 'NSX', 'S2000', 'Civic Type R', 'Integra Type R', 'Prelude', 'CR-X', 'Beat', 'S660', 'Del Sol'],
    'Hummer': ['H1', 'H2', 'H3'],
    'Hyundai': ['Accent', 'Elantra', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Palisade', 'Santa Cruz', 'Santa Fe', 'Sonata', 'Tucson', 'Veloster', 'Venue', 'Genesis Coupe', 'Tiburón', 'Veloster N'],
    'Infiniti': ['Q50', 'Q60', 'Q70', 'QX30', 'QX50', 'QX55', 'QX60', 'QX80', 'G35', 'G37', 'FX35', 'FX50', 'M37', 'M45'],
    'Jaguar': ['E-PACE', 'F-PACE', 'F-TYPE', 'I-PACE', 'XE', 'XF', 'XJ', 'XJS', 'XJ220'],
    'Jeep': ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Grand Cherokee L', 'Grand Wagoneer', 'Renegade', 'Wagoneer', 'Wrangler', 'Wrangler Rubicon', 'Wrangler Unlimited', 'Jeepster'],
    'Karma': ['Revero'],
    'Kia': ['Carnival', 'EV6', 'EV9', 'Forte', 'K5', 'Niro', 'Rio', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride', 'Optima'],
    'Koenigsegg': ['Agera', 'Regera', 'Jesko', 'Gemera', 'CCX', 'One:1'],
    'Lamborghini': ['Aventador', 'Huracan', 'Revuelto', 'Urus', 'Countach', 'Diablo', 'Murcielago', 'Gallardo', 'Miura'],
    'Land Rover': ['Defender', 'Defender 90', 'Defender 110', 'Defender 130', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
    'Lexus': ['ES', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'RZ', 'TX', 'UX', 'LFA', 'IS F', 'GS F', 'SC300', 'SC400'],
    'Lincoln': ['Aviator', 'Corsair', 'MKC', 'MKS', 'MKT', 'MKX', 'MKZ', 'Nautilus', 'Navigator', 'Town Car', 'Continental'],
    'Lotus': ['Elise', 'Emira', 'Evora', 'Exige', 'Esprit'],
    'Lucid': ['Air', 'Gravity'],
    'Maserati': ['Ghibli', 'GranTurismo', 'Grecale', 'Levante', 'MC20', 'Quattroporte', 'Spyder'],
    'Maybach': ['57', '62', 'Zeppelin', 'Exelero'],
    'Mazda': ['CX-3', 'CX-30', 'CX-5', 'CX-50', 'CX-70', 'CX-9', 'CX-90', 'Mazda3', 'Mazda6', 'MX-5 Miata', 'RX-7', 'RX-8', 'Cosmo', 'RX-7 FD', 'Mazdaspeed3', 'Mazdaspeed6'],
    'McLaren': ['570S', '600LT', '720S', '750S', '765LT', 'Artura', 'GT', 'P1', 'F1', 'Senna'],
    'Mercedes-Benz': ['A-Class', 'AMG G63', 'C-Class', 'CLA', 'CLS', 'E-Class', 'EQB', 'EQE', 'EQE SUV', 'EQS', 'EQS SUV', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'Metris', 'S-Class', 'SL', 'Sprinter', 'Sprinter RV', '190E Evo II', 'SLS AMG', 'SLR McLaren', 'AMG GT'],
    'Mercury': ['Grand Marquis', 'Mariner', 'Milan', 'Mountaineer', 'Cougar'],
    'Mini': ['Clubman', 'Cooper', 'Cooper Countryman', 'Countryman', 'Hardtop'],
    'Mitsubishi': ['Eclipse Cross', 'Mirage', 'Mirage G4', 'Outlander', 'Outlander Sport', 'Lancer Evolution', 'Lancer Evo', '3000GT', 'Starion', 'Delica', 'Eclipse GSX', 'Pajero'],
    'Nissan': ['Altima', 'Ariya', 'Armada', 'Frontier', 'GT-R', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Titan', 'Versa', 'Z', 'Skyline', 'Skyline GT-R', 'Silvia', '180SX', 'S13', 'S14', 'S15', '300ZX', '240SX', 'Fairlady Z', 'Stagea', 'Pulsar GTI-R'],
    'Noble': ['M600', 'M500'],
    'Oldsmobile': ['Alero', 'Aurora', 'Bravada', 'Intrigue', 'Silhouette', 'Cutlass', '442', 'Toronado'],
    'Pagani': ['Zonda', 'Huayra', 'Utopia'],
    'Polestar': ['1', '2', '3', '4'],
    'Pontiac': ['G6', 'Grand Prix', 'Solstice', 'Vibe', 'Firebird', 'Trans Am', 'GTO', 'Fiero', 'Grand Am'],
    'Porsche': ['718 Boxster', '718 Cayman', '911', '911 GT3', '911 Turbo', 'Cayenne', 'Macan', 'Macan EV', 'Panamera', 'Taycan', 'Taycan Cross Turismo', '911 GT3 RS', '918 Spyder', 'Carrera GT', '959', '944', '928'],
    'Ram': ['1500', '2500', '3500', 'ProMaster', 'ProMaster City', 'TRX'],
    'Rimac': ['Nevera', 'Concept One'],
    'Rivian': ['R1S', 'R1T'],
    'Rolls-Royce': ['Cullinan', 'Dawn', 'Ghost', 'Phantom', 'Spectre', 'Wraith', 'Silver Shadow'],
    'Saab': ['9-3', '9-5', '900 Turbo'],
    'Saleen': ['S7', 'S5S Raptor', 'S1'],
    'Saturn': ['Aura', 'Outlook', 'Sky', 'Vue', 'Ion Redline'],
    'Scion': ['FR-S', 'iA', 'iM', 'tC', 'xB', 'xD'],
    'Smart': ['EQ fortwo', 'fortwo'],
    'Spyker': ['C8', 'C12'],
    'Subaru': ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Solterra', 'WRX', 'WRX STI', 'Impreza WRX STI', 'Sambar', 'Brat', 'SVX'],
    'Suzuki': ['Grand Vitara', 'Kizashi', 'SX4', 'Jimny', 'Cappuccino'],
    'Tesla': ['Cybertruck', 'Model 3', 'Model S', 'Model X', 'Model Y', 'Roadster'],
    'Toyota': ['4Runner', 'Avalon', 'bZ4X', 'Camry', 'Corolla', 'Corolla Cross', 'Crown', 'GR86', 'Grand Highlander', 'Highlander', 'Land Cruiser', 'Mirai', 'Prius', 'RAV4', 'Sequoia', 'Sienna', 'Supra', 'Tacoma', 'Tundra', 'Venza', 'AE86', 'Sprinter Trueno', 'Chaser', 'MR2', 'Celica', 'Century', 'Cressida'],
    'VinFast': ['VF 8', 'VF 9'],
    'Volkswagen': ['Arteon', 'Atlas', 'Atlas Cross Sport', 'Golf', 'Golf GTI', 'Golf R', 'ID.4', 'ID.Buzz', 'Jetta', 'Passat', 'Taos', 'Tiguan', 'Beetle', 'Scirocco', 'Karmann Ghia'],
    'Volvo': ['C40 Recharge', 'S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90', '240', '850 T-5R']
}

result_dict = {}

print("Starting to fetch all vehicle models from NHTSA API...")
for i, make in enumerate(MAKES):
    print(f"[{i+1}/{len(MAKES)}] Fetching models for {make}...")
    url = f"https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/{make.replace(' ', '%20')}?format=json"
    
    api_models = []
    success = False
    
    # Try direct fetch (max 2 retries)
    for retry in range(2):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as response:
                data = json.loads(response.read().decode('utf-8'))
                results = data.get('Results', [])
                api_models = [r['Model_Name'].strip() for r in results if r.get('Model_Name')]
                success = True
                break
        except Exception as e:
            print(f"  Error fetching {make} (retry {retry+1}): {e}")
            time.sleep(1.5)
            
    # Combine with fallbacks
    fallbacks = FALLBACK_MODELS.get(make, [])
    combined = set()
    
    # Normalize strings (remove extra spaces and empty items)
    for model in api_models:
        if model:
            combined.add(model)
            
    for model in fallbacks:
        if model:
            combined.add(model)
            
    # Sort models
    sorted_models = sorted(list(combined))
    if not sorted_models:
        sorted_models = ["Other", "Model Unknown"]
        
    result_dict[make] = sorted_models
    print(f"  Complete! Total {len(sorted_models)} models for {make}.")
    
    # Sleep to avoid hammer
    time.sleep(0.2)

# Write output to services/allVehiclesModels.ts
output_path = r"C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\services\allVehiclesModels.ts"
print(f"Writing generated models database to {output_path}...")

ts_content = f"""// Auto-generated vehicle models database
// Compiled from NHTSA API & fallback definitions
// Total Makes: {len(MAKES)}

export const allVehiclesModels: Record<string, string[]> = {json.dumps(result_dict, indent=4)};
"""

with open(output_path, 'w', encoding='utf-8') as f:
    f.write(ts_content)

print("Successfully generated allVehiclesModels.ts!")
