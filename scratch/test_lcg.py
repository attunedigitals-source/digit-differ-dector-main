def lcg_permute(index, size, seed=42):
    # P is a prime number slightly larger than 369600
    P = 369623
    
    # We choose strong LCG constants. 
    # 'a' (multiplier) must be coprime to P.
    a = 15485863
    c = 2038074743 + seed
    
    val = (index * a + c) % P
    while val >= size:
        val = (val * a + c) % P
        
    return val

size = 369600
seen = set()
duplicates = 0

print("Testing refined LCG bijection for size 369,600...")
# Test all 369600 for uniqueness
for i in range(size):
    val = lcg_permute(i, size)
    if val in seen:
        duplicates += 1
    seen.add(val)

print(f"Tested all {size} values. Unique count: {len(seen)}, Duplicates: {duplicates}")
print("First 10 permuted indices:")
for i in range(10):
    print(f"Index {i} -> Shuffled Arrangement {lcg_permute(i, size) + 1}")
