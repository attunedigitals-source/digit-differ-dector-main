import React, { useState, useMemo, useEffect, useRef } from "react";
import { COUNTRIES, Country } from "@/data/countries";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, Check } from "lucide-react";

interface PhoneInputWithCountryProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  onBlur?: () => void;
}

export const PhoneInputWithCountry: React.FC<PhoneInputWithCountryProps> = ({
  value,
  onChange,
  required = false,
  className = "",
  id,
  placeholder = "8012345678",
  onBlur,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // Default Nigeria (+234)
  const [localNumber, setLocalNumber] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal state when external `value` changes
  useEffect(() => {
    if (!value) return;
    const cleanValue = value.trim();

    // Check if value starts with a known country dial code
    const foundCountry = COUNTRIES.find((c) => cleanValue.startsWith(c.dialCode));
    if (foundCountry) {
      setSelectedCountry(foundCountry);
      const numberPart = cleanValue.slice(foundCountry.dialCode.length).replace(/\D/g, "");
      setLocalNumber(numberPart);
    } else {
      // If no dial code match, keep only digits as local number
      const digitsOnly = cleanValue.replace(/\D/g, "");
      setLocalNumber(digitsOnly);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery("");
    
    // Format national number: strip leading 0 if present after country code
    let formattedLocal = localNumber.replace(/\D/g, "");
    if (formattedLocal.startsWith("0")) {
      formattedLocal = formattedLocal.substring(1);
    }
    setLocalNumber(formattedLocal);
    onChange(`${country.dialCode}${formattedLocal}`);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputVal = e.target.value;

    // Handle full pasted number containing dial code
    if (inputVal.startsWith("+")) {
      const matchCountry = COUNTRIES.find((c) => inputVal.startsWith(c.dialCode));
      if (matchCountry) {
        setSelectedCountry(matchCountry);
        let digits = inputVal.slice(matchCountry.dialCode.length).replace(/\D/g, "");
        if (digits.startsWith("0")) digits = digits.substring(1);
        setLocalNumber(digits);
        onChange(`${matchCountry.dialCode}${digits}`);
        return;
      }
    }

    // Keep only digits
    let digitsOnly = inputVal.replace(/\D/g, "");
    // Remove leading zero for standard international format if present
    if (digitsOnly.length > 10 && digitsOnly.startsWith("0")) {
      digitsOnly = digitsOnly.substring(1);
    }
    setLocalNumber(digitsOnly);
    onChange(digitsOnly ? `${selectedCountry.dialCode}${digitsOnly}` : "");
  };

  return (
    <div className={`relative flex items-center gap-1.5 ${className}`} ref={dropdownRef}>
      {/* Country Flag & Code Selector Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 h-10 rounded-md border border-border/60 bg-background/80 hover:bg-muted/50 transition-colors text-xs font-semibold shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Select Country Code"
        title="Select Country Flag & Calling Code"
      >
        <span className="text-base leading-none">{selectedCountry.flag}</span>
        <span className="font-mono font-bold text-foreground">{selectedCountry.dialCode}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Phone Number Input */}
      <div className="relative flex-1">
        <Input
          id={id}
          type="tel"
          required={required}
          value={localNumber}
          onChange={handleNumberChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className="bg-background/60 border-border/60 focus:border-primary font-mono tracking-wide pl-3 text-sm h-10"
        />
      </div>

      {/* Country Search Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 max-h-72 bg-card border border-border/80 rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-xl animate-in fade-in slide-in-from-top-1">
          {/* Search Box */}
          <div className="p-2 border-b border-border/60 bg-background/90 sticky top-0 z-10 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Search country name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Country List */}
          <div className="overflow-y-auto flex-1 divide-y divide-border/20 py-1">
            {filteredCountries.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No matching countries found
              </div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.code === selectedCountry.code;
                return (
                  <button
                    key={`${country.code}-${country.dialCode}`}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-primary/10 ${
                      isSelected ? "bg-primary/15 font-bold text-primary" : "text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="text-base shrink-0">{country.flag}</span>
                      <span className="truncate">{country.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">
                      <span>{country.dialCode}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary ml-1" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
