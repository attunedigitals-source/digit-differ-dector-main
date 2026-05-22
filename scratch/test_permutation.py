import math

def get_n_th_permutation(elements, counts, n):
    n -= 1 # convert to 0-indexed
    result = []
    total_elements = sum(counts)
    current_counts = list(counts)
    
    for position in range(total_elements):
        for i, elem in enumerate(elements):
            if current_counts[i] > 0:
                current_counts[i] -= 1
                denom = 1
                for c in current_counts:
                    denom *= math.factorial(c)
                num_perms = math.factorial(total_elements - 1 - position) // denom
                
                if n < num_perms:
                    result.append(elem)
                    break
                else:
                    n -= num_perms
                    current_counts[i] += 1
                    
    return result

elements = ['U4', 'O4', 'U5', 'O5']
counts = [3, 3, 3, 3]

print("Programmatic generated:")
for idx in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]:
    perm = get_n_th_permutation(elements, counts, idx)
    print(f"{idx}: {', '.join(perm)}")
