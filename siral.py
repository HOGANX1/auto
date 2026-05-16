import random
import string

def generate_serial():
    chars = string.ascii_uppercase + string.digits
    parts = []
    for _ in range(4):
        parts.append(''.join(random.choices(chars, k=4)))
    return '-'.join(parts)

def main():
    serials = set()
    count = 10000
    
    print(f"Generating {count} unique serials...")
    while len(serials) < count:
        serials.add(generate_serial())
    
    # Save to a text file
    with open('serials_list.txt', 'w') as f:
        for s in serials:
            f.write(s + '\n')
            
    # Generate SQL insert command
    print("Generating SQL script...")
    with open('insert_serials.sql', 'w') as f:
        f.write("-- SQL Script to insert 10,000 serials\n")
        f.write("INSERT INTO public.serials (key) VALUES \n")
        
        serial_list = list(serials)
        for i, s in enumerate(serial_list):
            ending = "," if i < len(serial_list) - 1 else ";"
            f.write(f"('{s}'){ending}\n")
            
    print("Done! Files created: 'serials_list.txt' and 'insert_serials.sql'")

if __name__ == "__main__":
    main()
