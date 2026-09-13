# VOLT Fuzz — LV2 plugin (C)

BUNDLE   := volt-fuzz.lv2
PREFIX   ?= $(HOME)/.lv2
CC       ?= gcc
CFLAGS   ?= -O2 -fPIC -Wall -Wextra -std=c99
CFLAGS   += $(shell pkg-config --cflags lv2)
LDFLAGS  += -lm

OBJS := volt_dsp.o volt_fuzz.o

.PHONY: all clean install uninstall test

all: $(BUNDLE)/volt_fuzz.so $(BUNDLE)/manifest.ttl $(BUNDLE)/volt_fuzz.ttl

$(BUNDLE):
	mkdir -p $(BUNDLE)

$(BUNDLE)/volt_fuzz.so: $(OBJS) | $(BUNDLE)
	$(CC) -shared -o $@ $(OBJS) $(LDFLAGS)

$(BUNDLE)/manifest.ttl: manifest.ttl | $(BUNDLE)
	cp $< $@

$(BUNDLE)/volt_fuzz.ttl: volt_fuzz.ttl | $(BUNDLE)
	cp $< $@

%.o: %.c volt_dsp.h
	$(CC) $(CFLAGS) -c -o $@ $<

install: all
	mkdir -p $(PREFIX)
	rm -rf $(PREFIX)/$(BUNDLE)
	cp -R $(BUNDLE) $(PREFIX)/

uninstall:
	rm -rf $(PREFIX)/$(BUNDLE)

test: all test_offline
	./test_offline

test_offline: test_offline.c volt_dsp.c volt_dsp.h
	$(CC) $(CFLAGS) -o $@ test_offline.c volt_dsp.c $(LDFLAGS)

clean:
	rm -f *.o test_offline
	rm -rf $(BUNDLE)
