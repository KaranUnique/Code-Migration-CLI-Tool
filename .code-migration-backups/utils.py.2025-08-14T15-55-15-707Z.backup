# Sample Python file with various issues for demonstration

import re
import imp  # Deprecated module
from collections import Mapping, Sequence  # Should use collections.abc

# Python 2 style print statements
print "Starting utility functions..."
print "Debug mode:", True

def format_message(name, age):
    # Old % string formatting
    message = "Hello %s, you are %d years old" % (name, age)
    
    # Could use f-strings instead of .format()
    formatted = "User: {} (Age: {})".format(name, age)
    
    print "Formatted message:", formatted
    return message

def process_text(text):
    # Should use raw string for regex
    pattern = "\\d+\\.\\d+"
    matches = re.findall(pattern, text)
    
    try:
        # Old exception syntax
        result = float(matches[0])
    except ValueError, e:
        print "Error processing text:", str(e)
        return None
    
    return result

def validate_data(data):
    # Type checking that could be improved
    if isinstance(data, Mapping):
        print "Data is a mapping"
        return True
    elif isinstance(data, Sequence):
        print "Data is a sequence"
        return True
    else:
        print "Unknown data type"
        return False

# Function with import order issue (this should come before 'from' imports)
import os
import sys

class DataProcessor:
    def __init__(self):
        print "Initializing DataProcessor..."
        self.data = {}
    
    def load_module(self, name):
        # Using deprecated imp module
        try:
            return imp.load_source(name, name + '.py')
        except ImportError, e:
            print "Failed to load module:", str(e)
            return None

if __name__ == "__main__":
    print "Running utility functions..."
    processor = DataProcessor()
    result = format_message("Alice", 30)
    print "Result:", result